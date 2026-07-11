
-- MODULE 40 — PHASE A (retry, unicité scoppée aux lignes gateway)

-- 1) CONFIG
CREATE TABLE IF NOT EXISTS public.communication_gateway_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enforce_single_door boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.communication_gateway_config TO authenticated;
GRANT ALL ON public.communication_gateway_config TO service_role;
ALTER TABLE public.communication_gateway_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comm_config_read_staff" ON public.communication_gateway_config;
CREATE POLICY "comm_config_read_staff" ON public.communication_gateway_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
INSERT INTO public.communication_gateway_config(id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2) AUDIT LOG
CREATE TABLE IF NOT EXISTS public.communication_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text,
  channel text NOT NULL CHECK (channel IN ('email','sms','notification','push')),
  template_key text,
  recipient text,
  actor_user_id uuid,
  actor_role text,
  decision text NOT NULL CHECK (decision IN ('queued','rejected','duplicate','suppressed','opted_out_marketing','opted_out_billing','unsubscribed','error','violation')),
  reason text,
  entity_type text,
  entity_id text,
  payload jsonb,
  queue_row_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_audit_correlation ON public.communication_audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_comm_audit_idempotency ON public.communication_audit_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_comm_audit_actor       ON public.communication_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_audit_created     ON public.communication_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_audit_decision    ON public.communication_audit_log(decision);
GRANT SELECT ON public.communication_audit_log TO authenticated;
GRANT ALL   ON public.communication_audit_log TO service_role;
ALTER TABLE public.communication_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comm_audit_read_staff" ON public.communication_audit_log;
CREATE POLICY "comm_audit_read_staff" ON public.communication_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

-- 3) IDEMPOTENCE (source de vérité de la porte canonique)
CREATE TABLE IF NOT EXISTS public.communication_idempotency (
  idempotency_key text PRIMARY KEY,
  channel text NOT NULL,
  correlation_id uuid NOT NULL,
  queue_row_id uuid,
  decision text NOT NULL,
  response jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 1
);
GRANT SELECT ON public.communication_idempotency TO authenticated;
GRANT ALL   ON public.communication_idempotency TO service_role;
ALTER TABLE public.communication_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comm_idem_read_admin" ON public.communication_idempotency;
CREATE POLICY "comm_idem_read_admin" ON public.communication_idempotency
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 4) COLONNES DURCISSEMENT
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS preferences_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS suppressed_reason text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

ALTER TABLE public.sms_queue
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS preferences_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS suppressed_reason text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS preferences_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

-- Unicité SCOPPÉE aux lignes de la porte canonique (correlation_id NOT NULL) :
-- les inserts legacy existants (correlation_id NULL) restent tolérés en Phase A.
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_queue_gateway_idempotency
  ON public.email_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND correlation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sms_queue_gateway_idempotency
  ON public.sms_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND correlation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_outbox_gateway_idempotency
  ON public.notification_outbox(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND correlation_id IS NOT NULL;

-- 5) RPC should_send
CREATE OR REPLACE FUNCTION public.rpc_communication_should_send(
  p_channel text,
  p_template_key text,
  p_recipient text,
  p_client_id uuid DEFAULT NULL,
  p_category text DEFAULT 'transactional'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_suppressed_reason text;
  v_prefs jsonb;
  v_unsub boolean := false;
BEGIN
  IF p_channel = 'email' THEN
    SELECT reason INTO v_suppressed_reason
      FROM public.suppressed_emails
     WHERE lower(email) = lower(p_recipient) LIMIT 1;
    IF v_suppressed_reason IS NOT NULL THEN
      RETURN jsonb_build_object('allow', false, 'reason', 'suppressed', 'detail', v_suppressed_reason);
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.email_unsubscribes WHERE lower(email) = lower(p_recipient))
      INTO v_unsub;
    IF v_unsub AND p_category = 'marketing' THEN
      RETURN jsonb_build_object('allow', false, 'reason', 'unsubscribed');
    END IF;

    IF p_client_id IS NOT NULL THEN
      SELECT to_jsonb(cep.*) INTO v_prefs
        FROM public.client_email_preferences cep
       WHERE cep.client_id = p_client_id LIMIT 1;
      IF v_prefs IS NOT NULL THEN
        IF p_category = 'marketing'
           AND coalesce((v_prefs->>'marketing_emails')::boolean, true) = false THEN
          RETURN jsonb_build_object('allow', false, 'reason', 'opted_out_marketing',
                                    'preferences_snapshot', v_prefs);
        END IF;
        IF p_category = 'billing'
           AND coalesce((v_prefs->>'billing_emails')::boolean, true) = false THEN
          RETURN jsonb_build_object('allow', false, 'reason', 'opted_out_billing',
                                    'preferences_snapshot', v_prefs);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('allow', true, 'preferences_snapshot', v_prefs);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_communication_should_send(text,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_communication_should_send(text,text,text,uuid,text)
  TO authenticated, service_role;

-- 6) RPC enqueue (porte canonique)
CREATE OR REPLACE FUNCTION public.rpc_communication_enqueue(
  p_channel text,
  p_template_key text,
  p_recipient text,
  p_template_vars jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_category text DEFAULT 'transactional',
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      correlation_id, entity_type, entity_id
    ) VALUES (
      p_idempotency_key, p_recipient, p_template_key, p_template_vars, p_template_key, 'queued',
      p_idempotency_key, p_actor_user_id, p_actor_role, v_prefs,
      v_correlation, p_entity_type, p_entity_id
    ) RETURNING id INTO v_queue_id;

  ELSIF p_channel = 'sms' THEN
    INSERT INTO public.sms_queue(
      to_phone, message, status, idempotency_key, actor_user_id, actor_role,
      preferences_snapshot, correlation_id
    ) VALUES (
      p_recipient, coalesce(p_template_vars->>'message',''), 'queued',
      p_idempotency_key, p_actor_user_id, p_actor_role, v_prefs, v_correlation
    ) RETURNING id INTO v_queue_id;

  ELSE
    INSERT INTO public.notification_outbox(
      event_type, payload, status, idempotency_key, actor_user_id, actor_role, correlation_id
    ) VALUES (
      p_template_key, p_template_vars, 'pending',
      p_idempotency_key, p_actor_user_id, p_actor_role, v_correlation
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
$$;
REVOKE ALL ON FUNCTION public.rpc_communication_enqueue(text,text,text,jsonb,text,uuid,text,uuid,text,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_communication_enqueue(text,text,text,jsonb,text,uuid,text,uuid,text,text,text,uuid,text)
  TO authenticated, service_role;

-- 7) TRIGGER SINGLE-DOOR (audit-only tant que enforce=false)
CREATE OR REPLACE FUNCTION public.tg_communications_single_door()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_via_gateway boolean;
  v_enforce boolean;
  v_channel text := TG_ARGV[0];
  v_row jsonb := to_jsonb(NEW);
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

  INSERT INTO public.communication_audit_log(
    correlation_id, idempotency_key, channel, template_key, recipient,
    decision, reason, payload
  ) VALUES (
    gen_random_uuid(),
    v_row->>'idempotency_key',
    v_channel,
    coalesce(v_row->>'template_key', v_row->>'event_type', v_row->>'event_key'),
    coalesce(v_row->>'to_email', v_row->>'to_phone', v_row->>'recipient'),
    'violation',
    format('Direct insert bypassing gateway (enforce=%s)', coalesce(v_enforce::text,'false')),
    v_row
  );

  IF coalesce(v_enforce, false) THEN
    RAISE EXCEPTION 'Direct insert into % is not allowed. Use rpc_communication_enqueue.', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_email_queue_single_door ON public.email_queue;
CREATE TRIGGER tg_email_queue_single_door
  BEFORE INSERT ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_communications_single_door('email');

DROP TRIGGER IF EXISTS tg_sms_queue_single_door ON public.sms_queue;
CREATE TRIGGER tg_sms_queue_single_door
  BEFORE INSERT ON public.sms_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_communications_single_door('sms');

DROP TRIGGER IF EXISTS tg_notification_outbox_single_door ON public.notification_outbox;
CREATE TRIGGER tg_notification_outbox_single_door
  BEFORE INSERT ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_communications_single_door('notification');

-- 8) CRON drain notification_outbox (auparavant orphelin)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-outbox') THEN
    PERFORM cron.schedule(
      'process-notification-outbox',
      '* * * * *',
      $cmd$SELECT net.http_post(
        url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/process-notification-outbox',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY')
        ),
        body:='{}'::jsonb
      )$cmd$
    );
  END IF;
END $$;
