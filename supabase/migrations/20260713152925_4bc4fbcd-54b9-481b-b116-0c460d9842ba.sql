CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_profile RECORD;
  v_email_result jsonb;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SET LOCAL statement_timeout = '60s';

  ALTER TABLE public.orders DISABLE TRIGGER USER;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  UPDATE public.orders SET
    payment_status = 'paid',
    status = 'confirmed',
    payment_confirmed_at = now(),
    updated_at = now()
  WHERE id = p_order_id
    AND payment_status != 'paid';

  ALTER TABLE public.orders ENABLE TRIGGER USER;

  INSERT INTO public.order_status_history (
    order_id,
    status_domain,
    old_status,
    new_status,
    actor_user_id,
    actor_role,
    actor_name,
    change_reason,
    metadata
  ) VALUES (
    p_order_id,
    'payment',
    v_order.payment_status,
    'paid',
    auth.uid(),
    'admin',
    'Nivra Core',
    'Paiement confirmé manuellement',
    jsonb_build_object('order_status', 'confirmed')
  );

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_order.user_id
  LIMIT 1;

  IF COALESCE(v_order.client_email, v_profile.email, '') <> '' THEN
    v_email_result := public.rpc_communication_enqueue(
      p_channel => 'email',
      p_template_key => 'payment_receipt',
      p_recipient => COALESCE(v_order.client_email, v_profile.email),
      p_template_vars => jsonb_build_object(
        'client_name', COALESCE(v_profile.full_name, concat_ws(' ', v_order.client_first_name, v_order.client_last_name), 'Client'),
        'CLIENT_FIRST_NAME', COALESCE(v_order.client_first_name, v_profile.first_name, 'Client'),
        'CLIENT_FULL_NAME', COALESCE(v_profile.full_name, concat_ws(' ', v_order.client_first_name, v_order.client_last_name), 'Client'),
        'order_number', COALESCE(v_order.order_number, ''),
        'ORDER_NUMBER', COALESCE(v_order.order_number, ''),
        'amount_paid', COALESCE(v_order.total_amount, 0),
        'AMOUNT', COALESCE(v_order.total_amount, 0)::text,
        'payment_method', 'Manuel',
        'PAYMENT_METHOD', 'Manuel',
        'paid_at', now()::text,
        'PAYMENT_DATE', to_char(now(), 'YYYY-MM-DD'),
        'status', 'confirmed'
      ),
      p_idempotency_key => 'order_payment_confirmed:' || p_order_id::text,
      p_category => 'billing',
      p_actor_user_id => auth.uid(),
      p_actor_role => 'admin',
      p_entity_type => 'order',
      p_entity_id => p_order_id::text,
      p_reason => 'Core manual payment confirmation',
      p_subject => 'Reçu de paiement — Nivra'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', 'confirmed',
    'payment_status', 'paid',
    'email', COALESCE(v_email_result, jsonb_build_object('queued', false, 'reason', 'missing_email'))
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_payment_receipt_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_email text;
  v_client_name text;
  v_invoice RECORD;
  v_order RECORD;
  v_event_key text;
BEGIN
  IF NOT (
    TG_OP = 'UPDATE'
    AND NEW.status = 'confirmed'
    AND (OLD.status IS DISTINCT FROM NEW.status)
  ) THEN
    RETURN NEW;
  END IF;

  v_event_key := 'payment_receipt_' || NEW.id::text;

  SELECT * INTO v_invoice
  FROM public.billing_invoices
  WHERE id = NEW.invoice_id;

  IF v_invoice.order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_invoice.order_id;
  END IF;

  SELECT bc.email, trim(concat_ws(' ', bc.first_name, bc.last_name))
  INTO v_client_email, v_client_name
  FROM public.billing_customers bc
  WHERE bc.id = NEW.customer_id;

  v_client_email := COALESCE(NULLIF(v_client_email, ''), NULLIF(v_order.client_email, ''));
  v_client_name := COALESCE(NULLIF(v_client_name, ''), NULLIF(trim(concat_ws(' ', v_order.client_first_name, v_order.client_last_name)), ''), 'Client');

  IF v_client_email IS NOT NULL AND v_client_email <> '' THEN
    PERFORM public.rpc_communication_enqueue(
      p_channel => 'email',
      p_template_key => 'payment_receipt',
      p_recipient => v_client_email,
      p_template_vars => jsonb_build_object(
        'client_name', v_client_name,
        'CLIENT_FIRST_NAME', split_part(v_client_name, ' ', 1),
        'CLIENT_FULL_NAME', v_client_name,
        'invoice_id', NEW.invoice_id,
        'invoice_number', COALESCE(v_invoice.invoice_number, ''),
        'INVOICE_NUMBER', COALESCE(v_invoice.invoice_number, ''),
        'order_number', COALESCE(v_order.order_number, ''),
        'ORDER_NUMBER', COALESCE(v_order.order_number, ''),
        'amount_paid', NEW.amount,
        'AMOUNT', NEW.amount::text,
        'payment_method', NEW.method,
        'PAYMENT_METHOD', NEW.method::text,
        'payment_reference', COALESCE(NEW.reference, NEW.provider_payment_id, ''),
        'paid_at', COALESCE(NEW.received_at::text, now()::text),
        'PAYMENT_DATE', to_char(COALESCE(NEW.received_at, now()), 'YYYY-MM-DD'),
        'status', 'confirmed'
      ),
      p_idempotency_key => v_event_key,
      p_category => 'billing',
      p_entity_type => CASE WHEN v_invoice.order_id IS NOT NULL THEN 'order' ELSE 'invoice' END,
      p_entity_id => COALESCE(v_invoice.order_id::text, NEW.invoice_id::text),
      p_reason => 'Confirmed payment receipt',
      p_subject => 'Reçu de paiement — Nivra'
    );
  END IF;

  RETURN NEW;
END;
$function$;