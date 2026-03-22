
CREATE OR REPLACE FUNCTION public.compute_invoice_breakdown(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Stored invoice header values (authoritative from pricing_snapshot at checkout)
  v_stored_subtotal_cents BIGINT;
  v_stored_tps_cents BIGINT;
  v_stored_tvq_cents BIGINT;
  v_stored_total_cents BIGINT;
  v_use_stored BOOLEAN := FALSE;
BEGIN
  -- Fetch the invoice header
  SELECT * INTO v_invoice 
  FROM billing_invoices 
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found', 'invoice_id', p_invoice_id);
  END IF;

  -- Capture stored header values (written at checkout from pricing_snapshot)
  v_stored_subtotal_cents := ROUND(COALESCE(v_invoice.subtotal, 0) * 100)::BIGINT;
  v_stored_tps_cents := ROUND(COALESCE(v_invoice.tps_amount, 0) * 100)::BIGINT;
  v_stored_tvq_cents := ROUND(COALESCE(v_invoice.tvq_amount, 0) * 100)::BIGINT;
  v_stored_total_cents := ROUND(COALESCE(v_invoice.total, 0) * 100)::BIGINT;

  -- Build items array and compute subtotals from lines
  FOR v_line IN 
    SELECT * FROM billing_invoice_lines 
    WHERE invoice_id = p_invoice_id 
    ORDER BY created_at ASC
  LOOP
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

  IF v_discounts_total_cents > v_subtotal_cents THEN
    v_discounts_total_cents := v_subtotal_cents;
  END IF;

  -- Taxable = subtotal - discounts
  v_taxable_cents := GREATEST(0, v_subtotal_cents - v_discounts_total_cents);
  v_tps_cents := ROUND(v_taxable_cents * 0.05);
  v_tvq_cents := ROUND(v_taxable_cents * 0.09975);
  v_total_cents := v_taxable_cents + v_tps_cents + v_tvq_cents;

  -- INTEGRITY CHECK: If stored invoice total differs from line-calculated total,
  -- use stored values (authoritative from pricing_snapshot written at checkout).
  -- This handles cases where invoice lines are incomplete or don't reflect
  -- preauth discounts / items not captured as lines.
  IF v_stored_total_cents > 0 AND ABS(v_stored_total_cents - v_total_cents) > 1 THEN
    v_use_stored := TRUE;
    -- Keep line-calculated subtotal/discounts for itemized display,
    -- but use stored header for taxes and total
    v_tps_cents := v_stored_tps_cents;
    v_tvq_cents := v_stored_tvq_cents;
    v_total_cents := v_stored_total_cents;
    -- Recalculate taxable from stored total - taxes
    v_taxable_cents := v_total_cents - v_tps_cents - v_tvq_cents;
  END IF;

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
    'used_stored_totals', v_use_stored,
    -- Convenience: dollar amounts
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
$function$;
