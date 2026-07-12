CREATE OR REPLACE FUNCTION public.build_invoice_from_order(p_order_id uuid, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE; v_customer_id uuid; v_invoice_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_gst_rate numeric(6,4) := 0.0500; v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2);
  v_item record; v_invoice_number text;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'p_order_id requis' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande % introuvable', p_order_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_customer_id FROM public.billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'billing_customer introuvable pour user %', v_order.user_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_invoice_id FROM public.billing_invoices WHERE order_id = p_order_id AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN RETURN v_invoice_id; END IF;

  SELECT COALESCE(SUM(line_total),0) INTO v_subtotal FROM public.order_items WHERE order_id = p_order_id;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);

  IF v_order.total_amount IS NOT NULL AND ABS(v_order.total_amount - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Incohérence order %: total_amount=% calcul=%', p_order_id, v_order.total_amount, v_total USING ERRCODE='check_violation';
  END IF;

  v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  INSERT INTO public.billing_invoices (
    customer_id, order_id, invoice_number, status, type,
    subtotal, tps_amount, tvq_amount, total,
    tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid
  ) VALUES (
    v_customer_id, p_order_id, v_invoice_number, 'pending', 'initial',
    v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
    jsonb_build_object('gst_rate',v_gst_rate,'qst_rate',v_qst_rate,'gst_amount',v_gst,'qst_amount',v_qst,'jurisdiction','QC','computed_at',now()),
    0
  ) RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id ORDER BY item_number LOOP
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total,
      line_type, source_ref, line_kind, source_order_item_id
    ) VALUES (
      v_invoice_id,
      v_item.plan_name || COALESCE(' — '||v_item.description,''),
      v_item.unit_price, v_item.quantity, v_item.line_total,
      CASE WHEN v_item.is_recurring THEN 'service' WHEN v_item.service_type::text='equipment' THEN 'equipment' ELSE 'fee' END,
      'order_item',
      CASE
        WHEN v_item.is_recurring THEN 'product_recurring'
        WHEN v_item.service_type::text='equipment' THEN 'equipment'
        WHEN v_item.service_type::text ILIKE '%shipping%' THEN 'shipping'
        WHEN v_item.service_type::text ILIKE '%activation%' THEN 'activation_fee'
        WHEN v_item.service_type::text ILIKE '%install%' THEN 'installation_fee'
        WHEN v_item.service_type::text ILIKE '%travel%' THEN 'travel_fee'
        ELSE 'product_one_time' END,
      v_item.id
    );
  END LOOP;

  PERFORM public._nivra_record_provenance('billing_invoice', v_invoice_id, 'created', 'build_invoice_from_order', p_context,
    'order', p_order_id, jsonb_build_object('subtotal',v_subtotal,'total',v_total));
  RETURN v_invoice_id;
END; $function$;