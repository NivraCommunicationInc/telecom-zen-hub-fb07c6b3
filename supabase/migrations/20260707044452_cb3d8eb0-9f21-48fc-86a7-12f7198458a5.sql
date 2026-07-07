-- Correction ciblée : cast enum sur build_invoice_ad_hoc.
-- Le corps reste identique à la migration Phase 3.A, seul le cast est ajouté.
CREATE OR REPLACE FUNCTION public.build_invoice_ad_hoc(
  p_customer_id      uuid,
  p_subscription_id  uuid,
  p_type             text,
  p_cycle_start      date,
  p_cycle_end        date,
  p_due_date         date,
  p_lines            jsonb,
  p_context          jsonb DEFAULT '{}'::jsonb,
  p_order_id         uuid  DEFAULT NULL,
  p_notes            text  DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id     uuid;
  v_invoice_number text;
  v_subtotal       numeric(10,2) := 0;
  v_gst_rate       numeric(6,4)  := 0.0500;
  v_qst_rate       numeric(6,4)  := 0.09975;
  v_gst            numeric(10,2);
  v_qst            numeric(10,2);
  v_total          numeric(10,2);
  v_line           jsonb;
  v_line_total     numeric(10,2);
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'p_customer_id requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'p_lines doit être un tableau JSON non vide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT id INTO v_invoice_id
      FROM public.billing_invoices
     WHERE order_id = p_order_id AND status NOT IN ('void','cancelled')
     LIMIT 1;
    IF v_invoice_id IS NOT NULL THEN RETURN v_invoice_id; END IF;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_line_total := ROUND(COALESCE((v_line->>'line_total')::numeric, 0), 2);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_subtotal := ROUND(v_subtotal, 2);
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);

  BEGIN
    SELECT public.generate_billing_invoice_number() INTO v_invoice_number;
  EXCEPTION WHEN undefined_function THEN
    v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  END;
  IF v_invoice_number IS NULL THEN
    v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  END IF;

  INSERT INTO public.billing_invoices (
    customer_id, subscription_id, order_id, invoice_number,
    type, status, currency,
    subtotal, tps_amount, tvq_amount, total,
    tax_gst_rate, tax_qst_rate, tax_snapshot,
    cycle_start_date, cycle_end_date, due_date, notes, amount_paid
  ) VALUES (
    p_customer_id, p_subscription_id, p_order_id, v_invoice_number,
    (COALESCE(NULLIF(p_type,''), 'initial'))::billing_invoice_type,
    'pending'::billing_invoice_status, 'CAD',
    v_subtotal, v_gst, v_qst, v_total,
    v_gst_rate, v_qst_rate,
    jsonb_build_object(
      'gst_rate', v_gst_rate, 'qst_rate', v_qst_rate,
      'gst_amount', v_gst,  'qst_amount', v_qst,
      'jurisdiction', 'QC', 'computed_at', now()
    ),
    p_cycle_start, p_cycle_end, p_due_date, p_notes, 0
  ) RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description,
      unit_price, quantity, line_total,
      line_type, line_kind, source_ref,
      service_address_id, metadata
    ) VALUES (
      v_invoice_id,
      COALESCE(v_line->>'description', 'Ligne'),
      ROUND(COALESCE((v_line->>'unit_price')::numeric, 0), 4),
      COALESCE((v_line->>'quantity')::int, 1),
      ROUND(COALESCE((v_line->>'line_total')::numeric, 0), 2),
      COALESCE(v_line->>'line_type', 'service'),
      COALESCE(v_line->>'line_kind', 'product_one_time'),
      COALESCE(v_line->>'source_ref', 'ad_hoc'),
      NULLIF(v_line->>'service_address_id','')::uuid,
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  PERFORM public._nivra_record_provenance(
    'billing_invoice', v_invoice_id, 'created', 'build_invoice_ad_hoc', p_context,
    CASE WHEN p_order_id IS NOT NULL THEN 'order' ELSE 'billing_subscription' END,
    COALESCE(p_order_id, p_subscription_id),
    jsonb_build_object('subtotal', v_subtotal, 'total', v_total,
                       'line_count', jsonb_array_length(p_lines))
  );

  RETURN v_invoice_id;
END;
$$;