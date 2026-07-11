
-- ============================================================
-- Module 40 — Phase B.1 : extend canonical enqueue RPC
-- ============================================================

-- 1) Add missing columns on email_queue
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS cc jsonb,
  ADD COLUMN IF NOT EXISTS bcc jsonb,
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 2) Add missing columns on sms_queue
ALTER TABLE public.sms_queue
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 3) Add missing columns on notification_outbox
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 4) Drop old signature so we can recreate with wider parameter list
DROP FUNCTION IF EXISTS public.rpc_communication_enqueue(
  text, text, text, jsonb, text, uuid, text, uuid, text, text, text, uuid, text
);

-- 5) Recreate extended canonical enqueue RPC
CREATE OR REPLACE FUNCTION public.rpc_communication_enqueue(
  p_channel          text,
  p_template_key     text,
  p_recipient        text,
  p_template_vars    jsonb   DEFAULT '{}'::jsonb,
  p_idempotency_key  text    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_category         text    DEFAULT 'transactional',
  p_actor_user_id    uuid    DEFAULT NULL,
  p_actor_role       text    DEFAULT NULL,
  p_entity_type      text    DEFAULT NULL,
  p_entity_id        text    DEFAULT NULL,
  p_correlation_id   uuid    DEFAULT NULL,
  p_reason           text    DEFAULT NULL,
  -- Extended parameters (B.1)
  p_subject          text    DEFAULT NULL,
  p_body_html        text    DEFAULT NULL,
  p_body_text        text    DEFAULT NULL,
  p_cc               jsonb   DEFAULT NULL,
  p_bcc              jsonb   DEFAULT NULL,
  p_reply_to         text    DEFAULT NULL,
  p_attachments      jsonb   DEFAULT NULL,
  p_priority         integer DEFAULT 0,
  p_scheduled_for    timestamptz DEFAULT NULL,
  p_to_name          text    DEFAULT NULL
)
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

  -- Idempotency short-circuit
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

  -- Preferences / suppression check
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

  -- Signal single-door trigger this insert comes from the gateway
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
    -- notification_outbox: satisfy NOT NULL columns
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

GRANT EXECUTE ON FUNCTION public.rpc_communication_enqueue(
  text, text, text, jsonb, text, uuid, text, uuid, text, text, text, uuid, text,
  text, text, text, jsonb, jsonb, text, jsonb, integer, timestamptz, text
) TO authenticated, service_role;
