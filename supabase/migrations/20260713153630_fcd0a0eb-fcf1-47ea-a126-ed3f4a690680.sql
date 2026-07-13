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
  v_template_vars jsonb;
  v_category text;
  v_entity_type text;
  v_entity_id text;
  v_subject text;
  v_body_html text;
  v_body_text text;
  v_cc jsonb;
  v_bcc jsonb;
  v_reply_to text;
  v_attachments jsonb;
  v_priority integer;
  v_scheduled_for timestamptz;
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
  v_recipient := COALESCE(
    NULLIF(v_row->>'to_email', ''),
    NULLIF(v_row->>'to_phone', ''),
    NULLIF(v_row->>'recipient', '')
  );
  v_template_key := COALESCE(
    NULLIF(v_row->>'template_key', ''),
    NULLIF(v_row->>'event_type', ''),
    NULLIF(v_row->>'event_key', ''),
    'inline-html'
  );
  v_template_vars := COALESCE(
    CASE WHEN v_row ? 'template_vars' THEN v_row->'template_vars' ELSE NULL END,
    CASE WHEN v_row ? 'data' THEN v_row->'data' ELSE NULL END,
    '{}'::jsonb
  );
  v_category := COALESCE(NULLIF(v_row->>'message_type', ''), 'transactional');
  IF v_category NOT IN ('transactional', 'marketing', 'billing', 'operational') THEN
    v_category := 'transactional';
  END IF;
  v_entity_type := NULLIF(v_row->>'entity_type', '');
  v_entity_id := NULLIF(v_row->>'entity_id', '');
  v_subject := NULLIF(v_row->>'subject', '');
  v_body_html := NULLIF(v_row->>'body_html', '');
  v_body_text := NULLIF(v_row->>'body_text', '');
  v_cc := CASE WHEN v_row ? 'cc' THEN v_row->'cc' ELSE NULL END;
  v_bcc := CASE WHEN v_row ? 'bcc' THEN v_row->'bcc' ELSE NULL END;
  v_reply_to := NULLIF(v_row->>'reply_to', '');
  v_attachments := CASE WHEN v_row ? 'attachments' THEN v_row->'attachments' ELSE NULL END;
  v_priority := COALESCE(NULLIF(v_row->>'priority', '')::integer, 0);
  v_scheduled_for := NULLIF(v_row->>'scheduled_for', '')::timestamptz;

  IF v_recipient IS NULL THEN
    INSERT INTO public.communication_audit_log(
      correlation_id, idempotency_key, channel, template_key, recipient,
      decision, reason, payload
    ) VALUES (
      gen_random_uuid(),
      v_idempotency_key,
      v_channel,
      v_template_key,
      NULL,
      'violation',
      'Legacy direct insert missing recipient and cannot be rerouted',
      v_row
    );

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
    p_template_vars => v_template_vars,
    p_idempotency_key => v_idempotency_key,
    p_client_id => NULL,
    p_category => v_category,
    p_actor_user_id => NULL,
    p_actor_role => 'legacy_trigger',
    p_entity_type => v_entity_type,
    p_entity_id => v_entity_id,
    p_correlation_id => NULL,
    p_reason => 'Legacy direct insert compatibility reroute',
    p_subject => v_subject,
    p_body_html => v_body_html,
    p_body_text => v_body_text,
    p_cc => v_cc,
    p_bcc => v_bcc,
    p_reply_to => v_reply_to,
    p_attachments => v_attachments,
    p_priority => v_priority,
    p_scheduled_for => v_scheduled_for,
    p_to_name => NULL
  );

  INSERT INTO public.communication_audit_log(
    correlation_id, idempotency_key, channel, template_key, recipient,
    decision, reason, payload
  ) VALUES (
    COALESCE(NULLIF(v_result->>'correlation_id', '')::uuid, gen_random_uuid()),
    v_idempotency_key,
    v_channel,
    v_template_key,
    v_recipient,
    'queued',
    format('Legacy direct insert rerouted through gateway (enforce=%s)', coalesce(v_enforce::text,'false')),
    v_row
  );

  RETURN NULL;
END;
$function$;