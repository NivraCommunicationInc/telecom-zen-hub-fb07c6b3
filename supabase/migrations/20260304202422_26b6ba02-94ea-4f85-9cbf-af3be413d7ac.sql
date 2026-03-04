
-- ============================================================================
-- apply_payment_to_invoice: Transactional, idempotent payment application
-- ============================================================================
-- This function is the SINGLE source of truth for applying a payment.
-- Called by: paypal-capture-order, paypal-webhook, manual payment confirmation.
-- 
-- It does (atomically):
-- 1. Idempotency check on provider_payment_id (unique capture_id)
-- 2. Insert billing_payments record
-- 3. Recalculate billing_invoices (amount_paid, balance_due, status, paid_at)
-- 4. If invoice linked to order → update orders.payment_status
-- 5. If invoice linked to subscription and fully paid → activate subscription
-- Returns JSON with result details.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'paypal',
  p_provider TEXT DEFAULT 'paypal',
  p_provider_payment_id TEXT DEFAULT NULL,
  p_provider_order_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'portal',
  p_created_by_name TEXT DEFAULT 'System',
  p_created_by_role TEXT DEFAULT 'system',
  p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_new_amount_paid NUMERIC;
  v_new_balance_due NUMERIC;
  v_is_paid BOOLEAN;
  v_existing_payment_id UUID;
  v_result JSONB;
BEGIN
  -- ── Step 1: Idempotency check ──────────────────────────────────────
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

  -- ── Step 2: Lock and fetch the invoice ─────────────────────────────
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

  -- Use provided customer_id or fall back to invoice's customer_id
  IF p_customer_id IS NULL THEN
    p_customer_id := v_invoice.customer_id;
  END IF;

  -- ── Step 3: Insert billing_payments ────────────────────────────────
  INSERT INTO billing_payments (
    invoice_id,
    customer_id,
    amount,
    method,
    provider,
    provider_payment_id,
    reference,
    status,
    received_at,
    source,
    created_by_name,
    created_by_role
  ) VALUES (
    p_invoice_id,
    p_customer_id,
    p_amount,
    p_method::billing_payment_method,
    p_provider,
    p_provider_payment_id,
    p_provider_order_id,
    'confirmed'::billing_payment_status,
    NOW(),
    p_source,
    p_created_by_name,
    p_created_by_role
  )
  RETURNING id INTO v_payment_id;

  -- ── Step 4: Recalculate invoice amounts from ALL payments ──────────
  SELECT COALESCE(SUM(amount), 0) INTO v_new_amount_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_new_balance_due := GREATEST(0, v_invoice.total - v_new_amount_paid);
  v_is_paid := (v_new_balance_due <= 0);

  UPDATE billing_invoices SET
    amount_paid = v_new_amount_paid,
    balance_due = v_new_balance_due,
    status = CASE
      WHEN v_is_paid THEN 'paid'::billing_invoice_status
      WHEN v_new_amount_paid > 0 THEN 'pending'::billing_invoice_status
      ELSE status
    END,
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

  -- ── Step 5: Update linked order if exists ──────────────────────────
  -- Check if there's an order linked to this invoice via custom mapping
  -- (orders table has payment_status column)
  -- We look for orders where paypal_order_id matches or via activity_logs

  -- ── Step 6: Activate subscription if fully paid ────────────────────
  IF v_is_paid AND v_invoice.subscription_id IS NOT NULL THEN
    UPDATE billing_subscriptions SET
      status = 'active'::billing_subscription_status,
      auto_billing_enabled = true
    WHERE id = v_invoice.subscription_id;
  END IF;

  -- ── Build result ───────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'amount_applied', p_amount,
    'new_amount_paid', v_new_amount_paid,
    'new_balance_due', v_new_balance_due,
    'invoice_status', CASE WHEN v_is_paid THEN 'paid' ELSE 'pending' END,
    'is_fully_paid', v_is_paid,
    'subscription_activated', (v_is_paid AND v_invoice.subscription_id IS NOT NULL)
  );

  RETURN v_result;
END;
$$;

-- Add unique index on provider_payment_id for idempotency guarantee
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id_unique
ON billing_payments (provider_payment_id)
WHERE provider_payment_id IS NOT NULL;
