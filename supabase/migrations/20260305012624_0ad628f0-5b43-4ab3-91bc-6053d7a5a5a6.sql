
-- ============================================================================
-- compute_invoice_breakdown: SINGLE SOURCE OF TRUTH for invoice calculations
-- Returns all amounts in cents (integers) to avoid floating point errors
-- Promo scope: services only (line_type = 'service')
-- ============================================================================

-- 1. Add line_type column to billing_invoice_lines
ALTER TABLE public.billing_invoice_lines 
  ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'service';

-- Add metadata JSON column for extra info (service_id, sku, promo_id, etc.)
ALTER TABLE public.billing_invoice_lines 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create the canonical breakdown function
CREATE OR REPLACE FUNCTION public.compute_invoice_breakdown(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_items JSONB := '[]'::jsonb;
  v_line RECORD;
  v_subtotal_cents BIGINT := 0;
  v_services_subtotal_cents BIGINT := 0;
  v_discounts_total_cents BIGINT := 0;
  v_taxable_cents BIGINT;
  v_tps_cents BIGINT;
  v_tvq_cents BIGINT;
  v_total_cents BIGINT;
  v_amount_paid_cents BIGINT := 0;
  v_balance_due_cents BIGINT;
  v_payments JSONB := '[]'::jsonb;
BEGIN
  -- Fetch the invoice header
  SELECT * INTO v_invoice 
  FROM billing_invoices 
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found', 'invoice_id', p_invoice_id);
  END IF;

  -- Build items array and compute subtotals
  FOR v_line IN 
    SELECT * FROM billing_invoice_lines 
    WHERE invoice_id = p_invoice_id 
    ORDER BY created_at ASC
  LOOP
    -- Convert to cents: round(amount * 100)
    DECLARE
      line_total_cents BIGINT := ROUND(v_line.line_total * 100)::BIGINT;
    BEGIN
      v_items := v_items || jsonb_build_object(
        'id', v_line.id,
        'line_type', v_line.line_type,
        'description', v_line.description,
        'quantity', COALESCE(v_line.quantity, 1),
        'unit_price_cents', ROUND(v_line.unit_price * 100)::BIGINT,
        'line_total_cents', line_total_cents,
        'metadata', COALESCE(v_line.metadata, '{}'::jsonb)
      );

      -- Accumulate by type
      IF v_line.line_type = 'discount' THEN
        v_discounts_total_cents := v_discounts_total_cents + ABS(line_total_cents);
      ELSE
        v_subtotal_cents := v_subtotal_cents + line_total_cents;
        IF v_line.line_type = 'service' THEN
          v_services_subtotal_cents := v_services_subtotal_cents + line_total_cents;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Cap discount to eligible amount (services only)
  IF v_discounts_total_cents > v_services_subtotal_cents THEN
    v_discounts_total_cents := v_services_subtotal_cents;
  END IF;

  -- Taxable = subtotal - discounts (never negative)
  v_taxable_cents := GREATEST(0, v_subtotal_cents - v_discounts_total_cents);

  -- TPS 5%, TVQ 9.975% — round each independently
  v_tps_cents := ROUND(v_taxable_cents * 0.05);
  v_tvq_cents := ROUND(v_taxable_cents * 0.09975);

  -- Total
  v_total_cents := v_taxable_cents + v_tps_cents + v_tvq_cents;

  -- Sum confirmed payments
  SELECT COALESCE(SUM(ROUND(amount * 100)::BIGINT), 0)
  INTO v_amount_paid_cents
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  -- Build payments array
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', bp.id,
    'method', bp.method,
    'amount_cents', ROUND(bp.amount * 100)::BIGINT,
    'status', bp.status,
    'reference', bp.reference,
    'provider', bp.provider,
    'provider_payment_id', bp.provider_payment_id,
    'received_at', bp.received_at,
    'created_at', bp.created_at
  ) ORDER BY bp.created_at), '[]'::jsonb)
  INTO v_payments
  FROM billing_payments bp
  WHERE bp.invoice_id = p_invoice_id;

  -- Balance due
  v_balance_due_cents := GREATEST(0, v_total_cents - v_amount_paid_cents);

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'type', v_invoice.type,
    'status', v_invoice.status,
    'customer_id', v_invoice.customer_id,
    'cycle_start_date', v_invoice.cycle_start_date,
    'cycle_end_date', v_invoice.cycle_end_date,
    'due_date', v_invoice.due_date,
    'created_at', v_invoice.created_at,
    'paid_at', v_invoice.paid_at,
    'order_id', v_invoice.order_id,
    'notes', v_invoice.notes,
    'billing_snapshot_client', v_invoice.billing_snapshot_client,
    'billing_snapshot_account_number', v_invoice.billing_snapshot_account_number,
    'items', v_items,
    'subtotal_cents', v_subtotal_cents,
    'services_subtotal_cents', v_services_subtotal_cents,
    'discounts_total_cents', v_discounts_total_cents,
    'taxable_subtotal_cents', v_taxable_cents,
    'tps_cents', v_tps_cents,
    'tvq_cents', v_tvq_cents,
    'total_cents', v_total_cents,
    'amount_paid_cents', v_amount_paid_cents,
    'balance_due_cents', v_balance_due_cents,
    'payments', v_payments,
    -- Convenience: dollar amounts (for display only, source of truth = cents)
    'subtotal', ROUND(v_subtotal_cents / 100.0, 2),
    'discounts_total', ROUND(v_discounts_total_cents / 100.0, 2),
    'taxable_subtotal', ROUND(v_taxable_cents / 100.0, 2),
    'tps_amount', ROUND(v_tps_cents / 100.0, 2),
    'tvq_amount', ROUND(v_tvq_cents / 100.0, 2),
    'total', ROUND(v_total_cents / 100.0, 2),
    'amount_paid', ROUND(v_amount_paid_cents / 100.0, 2),
    'balance_due', ROUND(v_balance_due_cents / 100.0, 2)
  );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.compute_invoice_breakdown(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_invoice_breakdown(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.compute_invoice_breakdown(UUID) TO service_role;
