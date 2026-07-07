CREATE OR REPLACE FUNCTION public.renew_subscription(
  p_subscription_id uuid, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_sub public.billing_subscriptions%ROWTYPE;
  v_invoice_id uuid; v_existing uuid;
  v_next_start date; v_next_end date;
  v_subtotal numeric(10,2);
  v_gst_rate numeric(6,4) := 0.0500;
  v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2);
  v_invoice_number text;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id USING ERRCODE='no_data_found'; END IF;
  IF v_sub.frozen_unit_price IS NULL OR v_sub.frozen_name IS NULL THEN
    RAISE EXCEPTION 'Abonnement % sans données figées (frozen_*)', p_subscription_id USING ERRCODE='check_violation';
  END IF;
  IF v_sub.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'Abonnement % non-renouvelable (statut=%)', p_subscription_id, v_sub.status USING ERRCODE='check_violation';
  END IF;

  v_next_start := COALESCE(v_sub.cycle_end_date, CURRENT_DATE);
  v_next_end   := v_next_start + INTERVAL '1 month';

  SELECT id INTO v_existing FROM public.billing_invoices
   WHERE subscription_id=v_sub.id AND type='renewal'
     AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
     AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_subtotal := v_sub.frozen_unit_price;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);
  v_invoice_number := 'INV-RNW-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);

  BEGIN
    INSERT INTO public.billing_invoices (
      customer_id, invoice_number, status, subscription_id, type,
      subtotal, tps_amount, tvq_amount, total,
      tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid,
      cycle_start_date, cycle_end_date, due_date, currency, payment_method
    ) VALUES (
      v_sub.customer_id, v_invoice_number, 'pending', v_sub.id, 'renewal',
      v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
      jsonb_build_object(
        'gst_rate', v_gst_rate, 'qst_rate', v_qst_rate,
        'gst_amount', v_gst, 'qst_amount', v_qst,
        'jurisdiction','QC','computed_at', now(),
        'source','renewal_frozen',
        'frozen_unit_price', v_sub.frozen_unit_price,
        'source_subscription_id', v_sub.id
      ),
      0, v_next_start, v_next_end, v_next_end, COALESCE(v_sub.frozen_currency,'CAD'), 'manual'
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_invoice_id FROM public.billing_invoices
     WHERE subscription_id=v_sub.id AND type='renewal'
       AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
       AND status NOT IN ('void','cancelled') LIMIT 1;
    RETURN v_invoice_id;
  END;

  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, source_order_item_id, metadata
  ) VALUES (
    v_invoice_id, v_sub.frozen_name || ' — Renouvellement',
    v_sub.frozen_unit_price, 1, v_sub.frozen_unit_price,
    'service', 'order_item', 'product_recurring', v_sub.source_order_item_id,
    jsonb_build_object(
      'source_subscription_id', v_sub.id, 'renewal', true,
      'frozen_unit_price', v_sub.frozen_unit_price,
      'frozen_name', v_sub.frozen_name, 'frozen_code', v_sub.frozen_code,
      'origin', 'renew_subscription'
    )
  );

  UPDATE public.billing_subscriptions
     SET last_invoice_id=v_invoice_id,
         cycle_start_date=v_next_start,
         cycle_end_date=v_next_end
   WHERE id=v_sub.id;

  PERFORM public._nivra_record_provenance(
    'billing_invoice', v_invoice_id, 'renewal_created','renew_subscription', p_context,
    'billing_subscription', v_sub.id,
    jsonb_build_object('frozen_price', v_sub.frozen_unit_price, 'total', v_total,
                       'cycle_start', v_next_start, 'cycle_end', v_next_end));
  RETURN v_invoice_id;
END $$;