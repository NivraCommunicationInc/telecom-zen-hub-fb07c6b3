CREATE OR REPLACE FUNCTION public.tg_communications_single_door()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_via_gateway boolean;
  v_enforce boolean;
  v_channel text := TG_ARGV[0];
  v_row jsonb := to_jsonb(NEW);
  v_result jsonb;
  v_idempotency_key text;
  v_recipient text;
  v_template_key text;
BEGIN
  BEGIN
    v_via_gateway := coalesce(current_setting('app.communication_gateway', true), 'off') = 'on';
  EXCEPTION WHEN OTHERS THEN
    v_via_gateway := false;
  END;

  IF v_via_gateway THEN
    RETURN NEW;
  END IF;

  SELECT enforce_single_door INTO v_enforce
    FROM public.communication_gateway_config WHERE id = true;

  v_idempotency_key := COALESCE(
    NULLIF(v_row->>'idempotency_key', ''),
    NULLIF(v_row->>'event_key', ''),
    v_channel || ':' || gen_random_uuid()::text
  );
  v_recipient := COALESCE(NULLIF(v_row->>'to_email', ''), NULLIF(v_row->>'to_phone', ''), NULLIF(v_row->>'recipient', ''));
  v_template_key := COALESCE(NULLIF(v_row->>'template_key', ''), NULLIF(v_row->>'event_type', ''), NULLIF(v_row->>'event_key', ''), 'inline-html');

  INSERT INTO public.communication_audit_log(
    correlation_id, idempotency_key, channel, template_key, recipient,
    decision, reason, payload
  ) VALUES (
    gen_random_uuid(),
    v_idempotency_key,
    v_channel,
    v_template_key,
    v_recipient,
    'legacy_rerouted',
    format('Legacy direct insert rerouted through gateway (enforce=%s)', coalesce(v_enforce::text,'false')),
    v_row
  );

  IF v_recipient IS NULL THEN
    IF coalesce(v_enforce, false) THEN
      RAISE EXCEPTION 'Direct insert into % is missing recipient and cannot be rerouted.', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  v_result := public.rpc_communication_enqueue(
    p_channel => v_channel,
    p_template_key => v_template_key,
    p_recipient => v_recipient,
    p_template_vars => COALESCE(NEW.template_vars, '{}'::jsonb),
    p_idempotency_key => v_idempotency_key,
    p_client_id => NULL,
    p_category => COALESCE(NULLIF(NEW.message_type, ''), 'transactional'),
    p_actor_user_id => NULL,
    p_actor_role => 'legacy_trigger',
    p_entity_type => NEW.entity_type,
    p_entity_id => NEW.entity_id,
    p_correlation_id => NULL,
    p_reason => 'Legacy direct insert compatibility reroute',
    p_subject => NEW.subject,
    p_body_html => NEW.body_html,
    p_body_text => NEW.body_text,
    p_cc => NEW.cc,
    p_bcc => NEW.bcc,
    p_reply_to => NEW.reply_to,
    p_attachments => NEW.attachments,
    p_priority => COALESCE(NEW.priority, 0),
    p_scheduled_for => NEW.scheduled_for,
    p_to_name => NULL
  );

  RETURN NULL;
END;
$function$;