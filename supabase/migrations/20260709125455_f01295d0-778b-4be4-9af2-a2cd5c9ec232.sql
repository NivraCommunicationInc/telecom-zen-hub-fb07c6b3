
CREATE OR REPLACE FUNCTION public.refund_payment(
  p_provider text, p_event_id text, p_original_payment_id uuid, p_amount numeric,
  p_external_reference text, p_reason text DEFAULT NULL::text,
  p_provider_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_new           boolean;
  v_refund_id     uuid;
  v_orig          record;
  v_signed_amount numeric(10,2);
  v_new_paid      numeric(10,2);
  v_invoice_total numeric(10,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide (doit être > 0, en valeur absolue)'
      USING ERRCODE='invalid_parameter_value';
  END IF;

  v_new := public.record_webhook_event(p_provider, p_event_id, 'refund', p_provider_created_at, NULL);
  IF NOT v_new THEN
    SELECT payment_id INTO v_refund_id
      FROM public.webhook_events_processed
     WHERE provider = p_provider AND event_id = p_event_id;
    RETURN v_refund_id;
  END IF;

  SELECT id, invoice_id, customer_id, method, provider
    INTO v_orig
    FROM public.billing_payments
   WHERE id = p_original_payment_id
   FOR UPDATE;
  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Paiement original introuvable: %', p_original_payment_id
      USING ERRCODE='no_data_found';
  END IF;

  v_signed_amount := -1 * abs(p_amount);

  INSERT INTO public.billing_payments (
    invoice_id, customer_id, amount, method, provider, reference,
    source, authorization_status, received_at,
    provider_event_id, provider_created_at, processed_at, rpc_used, payment_kind
  ) VALUES (
    v_orig.invoice_id, v_orig.customer_id, v_signed_amount,
    v_orig.method, v_orig.provider, p_external_reference,
    'webhook', 'refunded', now(),
    p_event_id, p_provider_created_at, now(), 'refund_payment', 'refund'
  ) RETURNING id INTO v_refund_id;

  SELECT total, amount_paid INTO v_invoice_total, v_new_paid
    FROM public.billing_invoices WHERE id = v_orig.invoice_id FOR UPDATE;
  v_new_paid := GREATEST(COALESCE(v_new_paid,0) - abs(p_amount), 0);
  UPDATE public.billing_invoices
     SET amount_paid = v_new_paid,
         status = CASE
           WHEN v_new_paid <= 0 THEN 'pending'::billing_invoice_status
           WHEN v_new_paid < v_invoice_total THEN 'partially_paid'::billing_invoice_status
           ELSE status
         END,
         paid_at = CASE WHEN v_new_paid < v_invoice_total THEN NULL ELSE paid_at END
   WHERE id = v_orig.invoice_id;

  PERFORM public._nivra_record_provenance(
    'billing_payment', v_refund_id, 'created', 'refund_payment', p_context,
    'billing_payment', p_original_payment_id,
    jsonb_build_object(
      'amount', p_amount, 'reason', p_reason,
      'webhook_event_id', p_event_id, 'webhook_provider', p_provider
    )
  );

  UPDATE public.webhook_events_processed
     SET invoice_id   = v_orig.invoice_id,
         payment_id   = v_refund_id,
         rpc_used     = 'refund_payment',
         processed_at = now()
   WHERE provider = p_provider AND event_id = p_event_id;

  RETURN v_refund_id;
END; $function$;
