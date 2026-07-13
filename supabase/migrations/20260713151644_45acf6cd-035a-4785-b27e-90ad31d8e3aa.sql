CREATE OR REPLACE FUNCTION public.trigger_billing_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_email text;
  v_client_name text;
  v_template_key text;
  v_event_key text;
BEGIN
  SELECT email, COALESCE(full_name, 'Client')
  INTO v_client_email, v_client_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;

  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_template_key := 'invoice_created';
    v_event_key := 'invoice_created_' || NEW.id::text;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'paid' THEN
        v_template_key := 'payment_received';
        v_event_key := 'payment_received_' || NEW.id::text;
      WHEN 'overdue' THEN
        v_template_key := 'invoice_overdue';
        v_event_key := 'invoice_overdue_' || NEW.id::text;
      WHEN 'failed', 'declined' THEN
        IF NEW.order_id IS NOT NULL THEN
          RETURN NEW;
        END IF;
        v_template_key := 'payment_failed';
        v_event_key := 'payment_failed_' || NEW.id::text;
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', v_client_name,
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'amount', NEW.amount,
      'due_date', NEW.due_date,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_communication_enqueue(p_channel text, p_template_key text, p_recipient text, p_template_vars jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL::text, p_client_id uuid DEFAULT NULL::uuid, p_category text DEFAULT 'transactional'::text, p_actor_user_id uuid DEFAULT NULL::uuid, p_actor_role text DEFAULT NULL::text, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_correlation_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_body_html text DEFAULT NULL::text, p_body_text text DEFAULT NULL::text, p_cc jsonb DEFAULT NULL::jsonb, p_bcc jsonb DEFAULT NULL::jsonb, p_reply_to text DEFAULT NULL::text, p_attachments jsonb DEFAULT NULL::jsonb, p_priority integer DEFAULT 0, p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to_name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_correlation uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_check jsonb;
  v_prefs jsonb;
  v_queue_id uuid;
  v_existing public.communication_idempotency%ROWTYPE;
  v_decision text;
  v_reason text;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key required (min 8 chars)';
  END IF;
  IF p_channel NOT IN ('email','sms','notification') THEN
    RAISE EXCEPTION 'invalid channel: %', p_channel;
  END IF;
  IF p_template_key IS NULL OR length(p_template_key) = 0 THEN
    RAISE EXCEPTION 'template_key required';
  END IF;
  IF p_recipient IS NULL OR length(p_recipient) = 0 THEN
    RAISE EXCEPTION 'recipient required';
  END IF;
  IF p_channel = 'email' AND p_recipient !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'invalid email: %', p_recipient;
  END IF;

  IF p_channel = 'email'
     AND p_template_key = 'payment_failed'
     AND p_entity_type = 'order' THEN
    INSERT INTO public.communication_audit_log(
      correlation_id, idempotency_key, channel, template_key, recipient,
      actor_user_id, actor_role, decision, reason, entity_type, entity_id, payload
    ) VALUES (
      v_correlation, p_idempotency_key, p_channel, p_template_key, p_recipient,
      p_actor_user_id, p_actor_role, 'blocked', 'order_payment_failed_client_email_disabled', p_entity_type, p_entity_id, p_template_vars
    );
    INSERT INTO public.communication_idempotency(
      idempotency_key, channel, correlation_id, decision, response
    ) VALUES (
      p_idempotency_key, p_channel, v_correlation, 'blocked',
      jsonb_build_object('queued', false, 'decision', 'blocked', 'reason', 'order_payment_failed_client_email_disabled')
    ) ON CONFLICT (idempotency_key) DO UPDATE
      SET hit_count = public.communication_idempotency.hit_count + 1,
          last_seen_at = now();
    RETURN jsonb_build_object('queued', false, 'decision', 'blocked', 'reason', 'order_payment_failed_client_email_disabled', 'correlation_id', v_correlation);
  END IF;

  SELECT * INTO v_existing FROM public.communication_idempotency
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    UPDATE public.communication_idempotency
       SET hit_count = hit_count + 1, last_seen_at = now()
     WHERE idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object(
      'duplicate', true,
      'correlation_id', v_existing.correlation_id,
      'queue_row_id', v_existing.queue_row_id,
      'decision', v_existing.decision
    );
  END IF;

  v_check := public.rpc_communication_should_send(p_channel, p_template_key, p_recipient, p_client_id, p_category);
  v_prefs := v_check->'preferences_snapshot';

  IF (v_check->>'allow')::boolean = false THEN
    v_decision := coalesce(v_check->>'reason', 'rejected');
    v_reason   := coalesce(v_check->>'detail', v_check->>'reason');

    INSERT INTO public.communication_audit_log(
      correlation_id, idempotency_key, channel, template_key, recipient,
      actor_user_id, actor_role, decision, reason, entity_type, entity_id, payload
    ) VALUES (
      v_correlation, p_idempotency_key, p_channel, p_template_key, p_recipient,
      p_actor_user_id, p_actor_role, v_decision, v_reason, p_entity_type, p_entity_id, p_template_vars
    );
    INSERT INTO public.communication_idempotency(
      idempotency_key, channel, correlation_id, decision, response
    ) VALUES (
      p_idempotency_key, p_channel, v_correlation, v_decision, v_check
    );
    RETURN jsonb_build_object(
      'queued', false, 'decision', v_decision, 'reason', v_reason,
      'correlation_id', v_correlation
    );
  END IF;

  PERFORM set_config('app.communication_gateway', 'on', true);

  IF p_channel = 'email' THEN
    INSERT INTO public.email_queue(
      event_key, to_email, template_key, template_vars, message_type, status,
      idempotency_key, actor_user_id, actor_role, preferences_snapshot,
      correlation_id, entity_type, entity_id,
      subject, body_html, body_text, cc, bcc, reply_to,
      attachments, priority, scheduled_for
    ) VALUES (
      p_idempotency_key, p_recipient, p_template_key, p_template_vars, p_template_key, 'queued',
      p_idempotency_key, p_actor_user_id, p_actor_role, v_prefs,
      v_correlation, p_entity_type, p_entity_id,
      p_subject, p_body_html, p_body_text, p_cc, p_bcc, p_reply_to,
      p_attachments, coalesce(p_priority, 0), p_scheduled_for
    ) RETURNING id INTO v_queue_id;

  ELSIF p_channel = 'sms' THEN
    INSERT INTO public.sms_queue(
      event_key, to_phone, message, status, idempotency_key, actor_user_id, actor_role,
      preferences_snapshot, correlation_id, priority, scheduled_for
    ) VALUES (
      p_idempotency_key, p_recipient,
      coalesce(p_template_vars->>'message', p_body_text, ''),
      'queued',
      p_idempotency_key, p_actor_user_id, p_actor_role, v_prefs, v_correlation,
      coalesce(p_priority, 0), p_scheduled_for
    ) RETURNING id INTO v_queue_id;

  ELSE
    INSERT INTO public.notification_outbox(
      event_type, recipient, to_email, to_name, subject,
      payload_json, status, idempotency_key, actor_user_id, actor_role,
      correlation_id, entity_type, entity_id, priority, scheduled_for,
      preferences_snapshot
    ) VALUES (
      p_template_key,
      'client',
      p_recipient,
      p_to_name,
      coalesce(p_subject, p_template_key),
      p_template_vars,
      'queued',
      p_idempotency_key, p_actor_user_id, p_actor_role,
      v_correlation, p_entity_type, p_entity_id,
      coalesce(p_priority, 0), p_scheduled_for,
      v_prefs
    ) RETURNING id INTO v_queue_id;
  END IF;

  INSERT INTO public.communication_audit_log(
    correlation_id, idempotency_key, channel, template_key, recipient,
    actor_user_id, actor_role, decision, reason, entity_type, entity_id, payload, queue_row_id
  ) VALUES (
    v_correlation, p_idempotency_key, p_channel, p_template_key, p_recipient,
    p_actor_user_id, p_actor_role, 'queued', p_reason, p_entity_type, p_entity_id, p_template_vars, v_queue_id
  );
  INSERT INTO public.communication_idempotency(
    idempotency_key, channel, correlation_id, queue_row_id, decision, response
  ) VALUES (
    p_idempotency_key, p_channel, v_correlation, v_queue_id, 'queued',
    jsonb_build_object('queue_row_id', v_queue_id)
  );

  RETURN jsonb_build_object(
    'queued', true, 'correlation_id', v_correlation,
    'queue_row_id', v_queue_id, 'decision', 'queued'
  );
END;
$function$;