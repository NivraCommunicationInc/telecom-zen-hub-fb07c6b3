CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(
  p_invoice_id uuid, p_amount numeric, p_method text, p_provider text,
  p_external_reference text, p_source text, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_payment_id uuid; v_customer_id uuid;
  v_new_paid numeric(10,2); v_total numeric(10,2);
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Montant requis' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT customer_id, total, amount_paid INTO v_customer_id, v_total, v_new_paid
    FROM public.billing_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Facture % introuvable', p_invoice_id USING ERRCODE='no_data_found'; END IF;

  INSERT INTO public.billing_payments (
    invoice_id, customer_id, amount,
    method, provider, reference,
    source, authorization_status, received_at
  ) VALUES (
    p_invoice_id, v_customer_id, p_amount,
    p_method::billing_payment_method, p_provider, p_external_reference,
    COALESCE(p_source,'live'), 'captured', now()
  ) RETURNING id INTO v_payment_id;

  v_new_paid := COALESCE(v_new_paid,0) + p_amount;
  UPDATE public.billing_invoices
     SET amount_paid = v_new_paid,
         paid_at = CASE WHEN v_new_paid >= v_total THEN now() ELSE paid_at END,
         status  = CASE WHEN v_new_paid >= v_total THEN 'paid'::billing_invoice_status ELSE status END
   WHERE id = p_invoice_id;

  PERFORM public._nivra_record_provenance(
    'billing_payment', v_payment_id, 'created', 'apply_payment_to_invoice', p_context,
    'billing_invoice', p_invoice_id,
    jsonb_build_object('amount',p_amount,'method',p_method,'provider',p_provider,'reference',p_external_reference)
  );
  RETURN v_payment_id;
END; $$;