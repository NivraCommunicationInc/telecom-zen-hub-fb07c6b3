-- Resolve RPC ambiguity and harden canonical payment application
-- 1) Drop legacy overloaded function signature causing non-unique resolution in PostgREST
DROP FUNCTION IF EXISTS public.apply_payment_to_invoice(
  uuid, numeric, text, text, text, text, text, text, text, uuid
);

-- 2) Keep a single canonical function signature and enforce duplicate-payment prevention
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'etransfer'::text,
  p_provider text DEFAULT NULL::text,
  p_provider_payment_id text DEFAULT NULL::text,
  p_provider_order_id text DEFAULT NULL::text,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'admin'::text,
  p_created_by_name text DEFAULT NULL::text,
  p_created_by_role text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_new_amount_paid NUMERIC;
  v_new_balance_due NUMERIC;
  v_existing_confirmed_amount NUMERIC;
  v_current_balance_due NUMERIC;
  v_is_paid BOOLEAN;
  v_is_partial BOOLEAN;
  v_existing_payment_id UUID;
  v_new_status TEXT;
  v_result JSONB;
  v_provision_result JSONB;
BEGIN
  -- Input validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment amount must be greater than 0'
    );
  END IF;

  -- Idempotency by provider payment id (when available)
  IF p_provider_payment_id IS NOT NULL THEN
    SELECT id INTO v_existing_payment_id
    FROM billing_payments
    WHERE provider_payment_id = p_provider_payment_id
    LIMIT 1;

    IF v_existing_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'payment_id', v_existing_payment_id,
        'message', 'Payment already recorded (idempotent)'
      );
    END IF;
  END IF;

  -- Lock and fetch invoice
  SELECT * INTO v_invoice
  FROM billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice not found: ' || p_invoice_id::text
    );
  END IF;

  IF p_customer_id IS NULL THEN
    p_customer_id := v_invoice.customer_id;
  END IF;

  -- Canonical paid/balance recomputation BEFORE insertion
  SELECT COALESCE(SUM(amount), 0)
  INTO v_existing_confirmed_amount
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_current_balance_due := GREATEST(0, COALESCE(v_invoice.total, 0) - v_existing_confirmed_amount);

  -- Prevent duplicate/extra payments on already settled invoices
  IF v_current_balance_due <= 0
     OR v_invoice.status IN ('paid', 'paid_by_promo', 'void', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_paid', true,
      'already_processed', true,
      'invoice_id', p_invoice_id,
      'invoice_number', v_invoice.invoice_number,
      'invoice_status', v_invoice.status,
      'new_amount_paid', v_existing_confirmed_amount,
      'new_balance_due', v_current_balance_due,
      'error', 'Invoice already settled'
    );
  END IF;

  -- Block overpayment to keep financial state deterministic
  IF p_amount > v_current_balance_due THEN
    RETURN jsonb_build_object(
      'success', false,
      'invoice_id', p_invoice_id,
      'invoice_number', v_invoice.invoice_number,
      'new_amount_paid', v_existing_confirmed_amount,
      'new_balance_due', v_current_balance_due,
      'error', format('Payment amount %.2s exceeds current balance_due %.2s', p_amount::text, v_current_balance_due::text)
    );
  END IF;

  -- Insert payment row
  INSERT INTO billing_payments (
    invoice_id, customer_id, amount, method, provider,
    provider_payment_id, reference, status, received_at,
    source, created_by_name, created_by_role
  ) VALUES (
    p_invoice_id, p_customer_id, p_amount,
    p_method::billing_payment_method, p_provider,
    p_provider_payment_id, p_provider_order_id,
    'confirmed'::billing_payment_status,
    NOW(), p_source, p_created_by_name, p_created_by_role
  )
  RETURNING id INTO v_payment_id;

  -- Recompute invoice from ALL confirmed payments
  SELECT COALESCE(SUM(amount), 0) INTO v_new_amount_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_new_balance_due := GREATEST(0, COALESCE(v_invoice.total, 0) - v_new_amount_paid);
  v_is_paid := (v_new_balance_due <= 0);
  v_is_partial := (NOT v_is_paid AND v_new_amount_paid > 0);

  IF v_is_paid THEN
    v_new_status := 'paid';
  ELSIF v_is_partial THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_invoice.status::text;
  END IF;

  UPDATE billing_invoices SET
    amount_paid = v_new_amount_paid,
    balance_due = v_new_balance_due,
    status = v_new_status::billing_invoice_status,
    paid_at = CASE WHEN v_is_paid THEN NOW() ELSE paid_at END,
    payment_method = p_method::billing_payment_method,
    billing_snapshot_payment = CASE WHEN v_is_paid THEN jsonb_build_object(
      'method', p_method,
      'paid_at', NOW()::text,
      'transaction_id', p_provider_payment_id,
      'amount', p_amount,
      'provider', p_provider
    ) ELSE billing_snapshot_payment END
  WHERE id = p_invoice_id;

  -- Sync linked order payment_status
  IF v_invoice.order_id IS NOT NULL THEN
    IF v_is_paid THEN
      UPDATE orders SET payment_status = 'paid' WHERE id = v_invoice.order_id;
    ELSIF v_is_partial THEN
      UPDATE orders SET payment_status = 'partial' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

  -- Activate subscription if fully paid
  IF v_is_paid AND v_invoice.subscription_id IS NOT NULL THEN
    UPDATE billing_subscriptions SET
      status = 'active'::billing_subscription_status,
      auto_billing_enabled = true
    WHERE id = v_invoice.subscription_id;
  END IF;

  -- Provision services when fully paid and linked to order
  IF v_is_paid AND v_invoice.order_id IS NOT NULL THEN
    v_provision_result := provision_services_for_order(v_invoice.order_id);

    IF NOT COALESCE((v_provision_result->>'success')::BOOLEAN, false) THEN
      INSERT INTO billing_system_alerts (
        alert_type, entity_type, entity_id, details
      ) VALUES (
        'provisioning_failed', 'order', v_invoice.order_id::text,
        jsonb_build_object(
          'invoice_id', p_invoice_id,
          'error', v_provision_result->>'error'
        )
      );
      UPDATE orders SET status = 'provisioning_failed' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'amount_applied', p_amount,
    'new_amount_paid', v_new_amount_paid,
    'new_balance_due', v_new_balance_due,
    'invoice_status', v_new_status,
    'is_fully_paid', v_is_paid,
    'order_synced', (v_invoice.order_id IS NOT NULL),
    'subscription_activated', (v_is_paid AND v_invoice.subscription_id IS NOT NULL),
    'provisioning', v_provision_result
  );

  RETURN v_result;
END;
$function$;