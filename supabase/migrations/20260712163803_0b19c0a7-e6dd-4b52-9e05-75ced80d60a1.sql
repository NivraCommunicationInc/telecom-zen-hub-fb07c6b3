
CREATE OR REPLACE FUNCTION public.fn_queue_order_sms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
  v_opt_in BOOLEAN;
  v_full_name TEXT;
  v_first TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status IS NULL OR OLD.status IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.phone_e164, p.phone), COALESCE(p.sms_opt_in, true), p.full_name, p.first_name
    INTO v_phone, v_opt_in, v_full_name, v_first
    FROM public.profiles p
   WHERE p.user_id = NEW.user_id;

  IF NOT v_opt_in OR v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    v_message := 'Nivra: Votre commande #' || COALESCE(NEW.order_number, NEW.id::text)
      || ' est confirmee. Merci '
      || COALESCE(NULLIF(TRIM(v_first), ''), SPLIT_PART(COALESCE(v_full_name,''),' ',1), 'client')
      || '! Suivi: nivra-telecom.ca/suivi-commande';

    PERFORM public.rpc_communication_enqueue(
      p_channel         => 'sms',
      p_template_key    => 'order_confirmed_sms',
      p_recipient       => v_phone,
      p_template_vars   => jsonb_build_object('message', v_message),
      p_idempotency_key => 'order_confirmed_sms_' || NEW.id::text,
      p_client_id       => NEW.user_id,
      p_category        => 'transactional',
      p_entity_type     => 'order',
      p_entity_id       => NEW.id::text,
      p_body_text       => v_message
    );
  END IF;

  IF NEW.status = 'activated' THEN
    v_message := 'Nivra: Votre service est active! Profitez de votre connexion.';

    PERFORM public.rpc_communication_enqueue(
      p_channel         => 'sms',
      p_template_key    => 'order_activated_sms',
      p_recipient       => v_phone,
      p_template_vars   => jsonb_build_object('message', v_message),
      p_idempotency_key => 'order_activated_sms_' || NEW.id::text,
      p_client_id       => NEW.user_id,
      p_category        => 'transactional',
      p_entity_type     => 'order',
      p_entity_id       => NEW.id::text,
      p_body_text       => v_message
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_queue_payment_sms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_opt_in BOOLEAN;
  v_first TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;

  SELECT bc.user_id INTO v_user_id
    FROM public.billing_customers bc
   WHERE bc.id = NEW.customer_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.phone_e164, p.phone), COALESCE(p.sms_opt_in, true), p.first_name
    INTO v_phone, v_opt_in, v_first
    FROM public.profiles p
   WHERE p.user_id = v_user_id;

  IF NOT v_opt_in OR v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  v_message := 'Nivra: Paiement de ' || to_char(COALESCE(NEW.amount, 0), 'FM999G999D00') || '$ recu. Merci '
    || COALESCE(NULLIF(TRIM(v_first), ''), 'client') || '!';

  PERFORM public.rpc_communication_enqueue(
    p_channel         => 'sms',
    p_template_key    => 'payment_confirmed_sms',
    p_recipient       => v_phone,
    p_template_vars   => jsonb_build_object('message', v_message),
    p_idempotency_key => 'payment_confirmed_sms_' || NEW.id::text,
    p_client_id       => v_user_id,
    p_category        => 'transactional',
    p_entity_type     => 'payment',
    p_entity_id       => NEW.id::text,
    p_body_text       => v_message
  );

  RETURN NEW;
END;
$function$;
