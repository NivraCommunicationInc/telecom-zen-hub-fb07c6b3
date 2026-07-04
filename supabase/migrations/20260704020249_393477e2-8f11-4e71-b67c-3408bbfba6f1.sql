
CREATE OR REPLACE FUNCTION public.apply_prorata_to_invoice(
  p_invoice_id uuid,
  p_account_id uuid,
  p_service_address_id uuid,
  p_activation_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_prorata jsonb;
  v_prorata_cents int;
  v_new_line_total numeric;
  v_new_unit_price numeric;
  v_lines_adjusted int := 0;
  v_new_subtotal numeric := 0;
  v_new_tps numeric;
  v_new_tvq numeric;
  v_new_total numeric;
  v_old_total numeric;
  v_days_remaining int;
  v_days_in_cycle int;
BEGIN
  IF p_invoice_id IS NULL OR p_account_id IS NULL OR p_service_address_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_ids');
  END IF;

  -- Idempotent: ne pas ré-appliquer si déjà proraté sur au moins une ligne
  IF EXISTS (
    SELECT 1 FROM public.billing_invoice_lines
    WHERE invoice_id = p_invoice_id
      AND prorata_metadata IS NOT NULL
      AND prorata_metadata ? 'applied_at'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_applied');
  END IF;

  FOR v_line IN
    SELECT id, description, unit_price, quantity, line_total, line_type
    FROM public.billing_invoice_lines
    WHERE invoice_id = p_invoice_id
      AND line_type = 'service'
      AND COALESCE(line_total, 0) > 0
  LOOP
    -- Cents à partir du montant ligne (line_total)
    v_prorata := public.compute_prorata_for_service(
      p_account_id,
      p_service_address_id,
      (ROUND(v_line.line_total * 100))::int,
      p_activation_date
    );

    v_prorata_cents := (v_prorata ->> 'prorata_cents')::int;
    v_days_remaining := (v_prorata ->> 'days_remaining')::int;
    v_days_in_cycle := (v_prorata ->> 'days_in_cycle')::int;
    v_new_line_total := ROUND((v_prorata_cents::numeric) / 100.0, 2);

    IF v_line.quantity IS NULL OR v_line.quantity = 0 THEN
      v_new_unit_price := v_new_line_total;
    ELSE
      v_new_unit_price := ROUND(v_new_line_total / v_line.quantity, 2);
    END IF;

    UPDATE public.billing_invoice_lines
    SET
      unit_price = v_new_unit_price,
      line_total = v_new_line_total,
      service_address_id = COALESCE(service_address_id, p_service_address_id),
      description = v_line.description ||
        CASE
          WHEN v_days_remaining = 0 THEN ' · Cycle plein'
          ELSE ' · Prorata ' || v_days_remaining::text || '/' || v_days_in_cycle::text || ' jours'
        END,
      prorata_metadata = jsonb_build_object(
        'applied_at', now(),
        'activation_date', p_activation_date,
        'account_id', p_account_id,
        'service_address_id', p_service_address_id,
        'original_line_total', v_line.line_total,
        'original_unit_price', v_line.unit_price,
        'days_remaining', v_days_remaining,
        'days_in_cycle', v_days_in_cycle,
        'prev_anchor', v_prorata -> 'prev_anchor',
        'next_anchor', v_prorata -> 'next_anchor',
        'prorata_cents', v_prorata_cents
      )
    WHERE id = v_line.id;

    v_lines_adjusted := v_lines_adjusted + 1;
  END LOOP;

  IF v_lines_adjusted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_recurring_lines');
  END IF;

  -- Recalcul sous-total = somme des lignes après prorata
  SELECT COALESCE(SUM(line_total), 0)
    INTO v_new_subtotal
  FROM public.billing_invoice_lines
  WHERE invoice_id = p_invoice_id;

  v_new_subtotal := ROUND(v_new_subtotal, 2);
  v_new_tps := ROUND(v_new_subtotal * 0.05, 2);
  v_new_tvq := ROUND(v_new_subtotal * 0.09975, 2);
  v_new_total := ROUND(v_new_subtotal + v_new_tps + v_new_tvq, 2);

  SELECT total INTO v_old_total FROM public.billing_invoices WHERE id = p_invoice_id;

  UPDATE public.billing_invoices
  SET
    subtotal = v_new_subtotal,
    tps_amount = v_new_tps,
    tvq_amount = v_new_tvq,
    total = v_new_total,
    amount_paid = CASE WHEN status = 'paid' THEN v_new_total ELSE amount_paid END,
    balance_due = CASE WHEN status = 'paid' THEN 0 ELSE v_new_total END
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lines_adjusted', v_lines_adjusted,
    'old_total', v_old_total,
    'new_subtotal', v_new_subtotal,
    'new_tps', v_new_tps,
    'new_tvq', v_new_tvq,
    'new_total', v_new_total,
    'activation_date', p_activation_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_prorata_to_invoice(uuid, uuid, uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_prorata_to_invoice(uuid, uuid, uuid, date) TO service_role;
