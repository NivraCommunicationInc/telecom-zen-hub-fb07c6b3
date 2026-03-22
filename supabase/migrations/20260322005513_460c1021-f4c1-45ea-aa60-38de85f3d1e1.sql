
-- ============================================================
-- FIX 1: protect_subscription_insert_activation
-- BUG: Only checks plan_code LIKE 'order-%' for paid order validation.
--      Subscriptions with plan_code like 'mobile_50' or 'internet_100'
--      are blocked from 'active' on insert even when invoice is paid.
-- FIX: Also check for paid invoice by order_id or subscription linkage.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_subscription_insert_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  has_paid BOOLEAN := FALSE;
  v_order_number TEXT;
BEGIN
  IF NEW.status = 'active' THEN
    -- Check 1: paid invoice linked to this subscription's order
    IF NEW.order_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing_invoices
        WHERE order_id = NEW.order_id
          AND status IN ('paid', 'paid_by_promo')
      ) INTO has_paid;
      IF has_paid THEN RETURN NEW; END IF;

      SELECT EXISTS (
        SELECT 1 FROM orders
        WHERE id = NEW.order_id
          AND (payment_status IN ('paid', 'authorized', 'captured') OR COALESCE(total_amount, 0) = 0)
      ) INTO has_paid;
      IF has_paid THEN RETURN NEW; END IF;
    END IF;

    -- Check 2: plan_code links to a paid order (legacy)
    IF NEW.plan_code LIKE 'order-%' THEN
      v_order_number := substring(NEW.plan_code from 7);
      SELECT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.order_number = v_order_number
        AND (o.payment_status IN ('paid', 'authorized', 'captured') OR o.total_amount = 0)
      ) INTO has_paid;
      IF has_paid THEN RETURN NEW; END IF;
    END IF;

    -- Check 3: paid invoice already exists for this subscription's customer + order
    IF NEW.customer_id IS NOT NULL AND NEW.order_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing_invoices
        WHERE customer_id = NEW.customer_id
          AND order_id = NEW.order_id
          AND status IN ('paid', 'paid_by_promo')
      ) INTO has_paid;
      IF has_paid THEN RETURN NEW; END IF;
    END IF;
    
    IF NOT has_paid THEN
      INSERT INTO billing_system_alerts (
        alert_type, entity_type, entity_id, details
      ) VALUES (
        'DIRECT_ACTIVE_INSERT', 'billing_subscriptions', NEW.id,
        jsonb_build_object(
          'customer_id', NEW.customer_id,
          'plan_code', NEW.plan_code,
          'order_id', NEW.order_id,
          'message', 'Attempted to insert subscription with active status without paid order'
        )
      );
      RAISE WARNING '[BILLING V2] BLOCKED: Cannot insert subscription with active status without paid order. Setting to pending.';
      NEW.status := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- FIX 2: apply_payment_to_invoice — advance next_renewal_at on reactivation
-- BUG: When a suspended sub is reactivated via late payment, next_renewal_at
--      is NOT advanced, causing the renewal job to not pick it up.
-- FIX: Set next_renewal_at = cycle_end_date - 3 on reactivation.
-- ============================================================

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
  v_sub_cycle_end DATE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than 0');
  END IF;

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

  SELECT * INTO v_invoice
  FROM billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found: ' || p_invoice_id::text);
  END IF;

  IF p_customer_id IS NULL THEN
    p_customer_id := v_invoice.customer_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_existing_confirmed_amount
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_current_balance_due := GREATEST(0, COALESCE(v_invoice.total, 0) - v_existing_confirmed_amount);

  IF v_current_balance_due <= 0 OR v_invoice.status IN ('paid', 'paid_by_promo', 'void', 'cancelled') THEN
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

  IF v_invoice.order_id IS NOT NULL THEN
    IF v_is_paid THEN
      UPDATE orders SET payment_status = 'paid' WHERE id = v_invoice.order_id;
    ELSIF v_is_partial THEN
      UPDATE orders SET payment_status = 'partial' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

  IF v_is_paid AND v_invoice.subscription_id IS NOT NULL THEN
    -- Get current cycle_end_date to compute next_renewal_at
    SELECT cycle_end_date INTO v_sub_cycle_end
    FROM billing_subscriptions
    WHERE id = v_invoice.subscription_id;

    UPDATE billing_subscriptions SET
      status = 'active'::billing_subscription_status,
      auto_billing_enabled = true,
      -- Ensure next_renewal_at is set for the renewal job to pick up
      next_renewal_at = CASE 
        WHEN v_sub_cycle_end IS NOT NULL THEN (v_sub_cycle_end - INTERVAL '3 days')
        ELSE next_renewal_at
      END,
      recurring_provider = COALESCE(recurring_provider, 'internal'),
      updated_at = NOW()
    WHERE id = v_invoice.subscription_id;
  END IF;

  RETURN jsonb_build_object(
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
    'subscription_activated', (v_is_paid AND v_invoice.subscription_id IS NOT NULL)
  );
END;
$function$;

-- ============================================================
-- FIX 3: Repair subscription 72a7a5ab — paid invoice but sub stuck pending
-- ============================================================
UPDATE billing_subscriptions
SET status = 'active',
    recurring_provider = COALESCE(recurring_provider, 'internal'),
    updated_at = NOW()
WHERE id = '72a7a5ab-36e5-4b56-998a-c8b012f498df';

-- Also repair sub 5248b985 recurring_provider
UPDATE billing_subscriptions
SET recurring_provider = COALESCE(recurring_provider, 'internal'),
    recurring_setup_status = COALESCE(recurring_setup_status, 'pending')
WHERE recurring_provider IS NULL
  AND environment = 'live';
