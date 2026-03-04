
-- ============================================================================
-- Fix #1: Add 'partially_paid' to billing_invoice_status enum
-- Fix #2: Add order_id column to billing_invoices
-- Fix #3: Rewrite apply_payment_to_invoice with order sync + correct statuses
-- ============================================================================

-- Add partially_paid to invoice status enum
ALTER TYPE billing_invoice_status ADD VALUE IF NOT EXISTS 'partially_paid' AFTER 'pending';

-- Add order_id to billing_invoices (nullable FK to orders)
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_billing_invoices_order_id ON billing_invoices(order_id) WHERE order_id IS NOT NULL;

-- Recreate the canonical payment function with all fixes
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
  v_is_partial BOOLEAN;
  v_existing_payment_id UUID;
  v_new_status TEXT;
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

  -- ── Step 3: Insert billing_payments (status = confirmed) ───────────
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

  -- ── Step 4: Recalculate invoice from ALL confirmed payments ────────
  SELECT COALESCE(SUM(amount), 0) INTO v_new_amount_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_new_balance_due := GREATEST(0, v_invoice.total - v_new_amount_paid);
  v_is_paid := (v_new_balance_due <= 0);
  v_is_partial := (NOT v_is_paid AND v_new_amount_paid > 0);

  -- Determine new status: unpaid → partially_paid → paid
  IF v_is_paid THEN
    v_new_status := 'paid';
  ELSIF v_is_partial THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_invoice.status::text;  -- keep current
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

  -- ── Step 5: Sync linked order payment_status ───────────────────────
  IF v_invoice.order_id IS NOT NULL THEN
    IF v_is_paid THEN
      UPDATE orders SET payment_status = 'paid' WHERE id = v_invoice.order_id;
    ELSIF v_is_partial THEN
      UPDATE orders SET payment_status = 'partial' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

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
    'invoice_status', v_new_status,
    'is_fully_paid', v_is_paid,
    'order_synced', (v_invoice.order_id IS NOT NULL),
    'subscription_activated', (v_is_paid AND v_invoice.subscription_id IS NOT NULL)
  );

  RETURN v_result;
END;
$$;
