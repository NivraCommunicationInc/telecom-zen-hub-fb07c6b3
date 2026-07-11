
-- ============================================================
-- MODULE 41 — PHASE A: Foundations Notes & Activités (audit-only)
-- ============================================================

-- 1) CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.account_journal_gateway_config (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  enforce_single_door BOOLEAN NOT NULL DEFAULT false,
  audit_mode BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT singleton_config CHECK (id = true)
);
GRANT SELECT ON public.account_journal_gateway_config TO authenticated;
GRANT ALL ON public.account_journal_gateway_config TO service_role;
ALTER TABLE public.account_journal_gateway_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read config" ON public.account_journal_gateway_config;
CREATE POLICY "admin read config" ON public.account_journal_gateway_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.account_journal_gateway_config(id, enforce_single_door, audit_mode)
  VALUES (true, false, true) ON CONFLICT (id) DO NOTHING;

-- 2) AUDIT LOG
CREATE TABLE IF NOT EXISTS public.account_journal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id UUID,
  event_key TEXT,
  target_table TEXT NOT NULL,
  target_id UUID,
  operation TEXT NOT NULL, -- INSERT | UPDATE | DELETE | VIOLATION | WRITE
  via_gateway BOOLEAN NOT NULL DEFAULT false,
  enforcement_mode TEXT NOT NULL DEFAULT 'audit', -- audit | strict
  actor_user_id UUID,
  actor_role TEXT,
  actor_name TEXT,
  client_id UUID,
  account_id UUID,
  order_id UUID,
  payload JSONB,
  violation_reason TEXT,
  session_user_name TEXT DEFAULT session_user,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_journal_audit_log TO authenticated;
GRANT ALL ON public.account_journal_audit_log TO service_role;
ALTER TABLE public.account_journal_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read journal audit" ON public.account_journal_audit_log;
CREATE POLICY "admin read journal audit" ON public.account_journal_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ajal_correlation ON public.account_journal_audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ajal_event_key ON public.account_journal_audit_log(event_key);
CREATE INDEX IF NOT EXISTS idx_ajal_target ON public.account_journal_audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_ajal_created ON public.account_journal_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ajal_client ON public.account_journal_audit_log(client_id);

-- 3) IDEMPOTENCY
CREATE TABLE IF NOT EXISTS public.account_journal_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  target_table TEXT NOT NULL,
  target_id UUID,
  correlation_id UUID,
  actor_user_id UUID,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
GRANT SELECT ON public.account_journal_idempotency TO authenticated;
GRANT ALL ON public.account_journal_idempotency TO service_role;
ALTER TABLE public.account_journal_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read idem" ON public.account_journal_idempotency;
CREATE POLICY "admin read idem" ON public.account_journal_idempotency
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ajidem_expires ON public.account_journal_idempotency(expires_at);
CREATE INDEX IF NOT EXISTS idx_ajidem_target ON public.account_journal_idempotency(target_table, target_id);

-- 4) ADD COLUMNS TO CORE TABLES (nullable, backward compatible)
ALTER TABLE public.client_activity_logs
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.client_internal_notes
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.account_followups
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT;
-- order_status_history already has metadata JSONB

ALTER TABLE public.order_internal_notes
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 5) UNIQUE INDEX FOR EVENT_KEY IDEMPOTENCE (partial, allow NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cal_event_key ON public.client_activity_logs(event_key) WHERE event_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_al_event_key  ON public.activity_logs(event_key)         WHERE event_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cin_event_key ON public.client_internal_notes(event_key) WHERE event_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_af_event_key  ON public.account_followups(event_key)     WHERE event_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_osh_event_key ON public.order_status_history(event_key)  WHERE event_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_oin_event_key ON public.order_internal_notes(event_key)  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cal_correlation ON public.client_activity_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_al_correlation  ON public.activity_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_cin_correlation ON public.client_internal_notes(correlation_id);
CREATE INDEX IF NOT EXISTS idx_af_correlation  ON public.account_followups(correlation_id);
CREATE INDEX IF NOT EXISTS idx_osh_correlation ON public.order_status_history(correlation_id);
CREATE INDEX IF NOT EXISTS idx_oin_correlation ON public.order_internal_notes(correlation_id);

-- 6) CANONICAL RPC
CREATE OR REPLACE FUNCTION public.rpc_account_journal_write(
  p_target_table TEXT,
  p_payload JSONB,
  p_event_key TEXT DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_event_key TEXT := p_event_key;
  v_correlation_id UUID := COALESCE(p_correlation_id, gen_random_uuid());
  v_new_id UUID;
  v_existing JSONB;
  v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_client_id UUID;
  v_account_id UUID;
  v_order_id UUID;
BEGIN
  -- Authn
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL-401: authentication required' USING ERRCODE = '42501';
  END IF;

  -- Idempotency short-circuit
  IF v_event_key IS NOT NULL THEN
    SELECT result INTO v_existing
      FROM public.account_journal_idempotency
      WHERE event_key = v_event_key
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'result', v_existing);
    END IF;
  END IF;

  -- Server-side actor resolution
  SELECT
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
    p.email
    INTO v_actor_name, v_actor_email
    FROM public.profiles p WHERE p.id = v_actor_user_id;

  SELECT ur.role::text INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor_user_id
    ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 9 END
    LIMIT 1;
  v_actor_role := COALESCE(v_actor_role, 'authenticated');

  -- Extract common identifiers
  v_client_id  := NULLIF(v_payload->>'client_id','')::uuid;
  v_account_id := NULLIF(v_payload->>'account_id','')::uuid;
  v_order_id   := NULLIF(v_payload->>'order_id','')::uuid;

  -- Validation
  IF p_target_table NOT IN (
    'client_activity_logs','activity_logs','client_internal_notes',
    'account_followups','order_status_history','order_internal_notes'
  ) THEN
    RAISE EXCEPTION 'JOURNAL-400: target_table % not allowed', p_target_table USING ERRCODE = '22023';
  END IF;

  -- Dispatch
  IF p_target_table = 'client_activity_logs' THEN
    INSERT INTO public.client_activity_logs(
      client_id, actor_user_id, actor_name, actor_role,
      action_type, entity_type, entity_id, summary,
      before_data, after_data,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_actor_user_id, v_actor_name, v_actor_role,
      COALESCE(v_payload->>'action_type','note'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      v_payload->>'summary',
      v_payload->'before_data', v_payload->'after_data',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'activity_logs' THEN
    INSERT INTO public.activity_logs(
      user_id, action, entity_type, entity_id, details,
      actor_role, actor_name, actor_email,
      changed_field, reason, old_value, new_value,
      correlation_id, event_key, metadata
    ) VALUES (
      v_actor_user_id,
      COALESCE(v_payload->>'action','write'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      COALESCE(v_payload->'details','{}'::jsonb),
      v_actor_role, v_actor_name, v_actor_email,
      v_payload->>'changed_field', v_payload->>'reason',
      v_payload->>'old_value', v_payload->>'new_value',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'client_internal_notes' THEN
    INSERT INTO public.client_internal_notes(
      client_id, account_id, note_type, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      COALESCE(v_payload->>'note_type','general'),
      v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'account_followups' THEN
    INSERT INTO public.account_followups(
      client_user_id, account_id, title, description,
      category, priority, status, due_at,
      assigned_to, assigned_to_email,
      created_by, created_by_email,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      v_payload->>'title', v_payload->>'description',
      COALESCE(v_payload->>'category','general'),
      COALESCE(v_payload->>'priority','normal'),
      COALESCE(v_payload->>'status','open'),
      NULLIF(v_payload->>'due_at','')::timestamptz,
      NULLIF(v_payload->>'assigned_to','')::uuid,
      v_payload->>'assigned_to_email',
      v_actor_user_id, v_actor_email,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_status_history' THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_user_id, actor_role, actor_name, change_reason, metadata,
      correlation_id, event_key
    ) VALUES (
      v_order_id, v_payload->>'status_domain',
      v_payload->>'old_status', v_payload->>'new_status',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_payload->>'change_reason',
      COALESCE(v_payload->'metadata','{}'::jsonb),
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_internal_notes' THEN
    INSERT INTO public.order_internal_notes(
      order_id, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_order_id, v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;
  END IF;

  -- Idempotency record
  IF v_event_key IS NOT NULL THEN
    INSERT INTO public.account_journal_idempotency(
      event_key, target_table, target_id, correlation_id, actor_user_id, result
    ) VALUES (
      v_event_key, p_target_table, v_new_id, v_correlation_id, v_actor_user_id,
      jsonb_build_object('id', v_new_id)
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  -- Audit
  INSERT INTO public.account_journal_audit_log(
    correlation_id, event_key, target_table, target_id, operation,
    via_gateway, enforcement_mode,
    actor_user_id, actor_role, actor_name,
    client_id, account_id, order_id, payload
  ) VALUES (
    v_correlation_id, v_event_key, p_target_table, v_new_id, 'WRITE',
    true, 'audit',
    v_actor_user_id, v_actor_role, v_actor_name,
    v_client_id, v_account_id, v_order_id, v_payload
  );

  RETURN jsonb_build_object(
    'ok', true, 'id', v_new_id,
    'correlation_id', v_correlation_id,
    'event_key', v_event_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_account_journal_write(TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;

-- 7) SINGLE-DOOR TRIGGER (audit-only)
CREATE OR REPLACE FUNCTION public.tg_notes_single_door()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enforce BOOLEAN;
  v_via_gateway BOOLEAN;
BEGIN
  SELECT enforce_single_door INTO v_enforce
    FROM public.account_journal_gateway_config WHERE id = true;
  v_enforce := COALESCE(v_enforce, false);

  -- Detect gateway path via session var set by RPC context
  v_via_gateway := (current_setting('app.journal_gateway', true) = 'on');

  IF NOT v_via_gateway THEN
    INSERT INTO public.account_journal_audit_log(
      correlation_id, event_key, target_table, target_id, operation,
      via_gateway, enforcement_mode,
      actor_user_id, payload, violation_reason
    ) VALUES (
      NULL, NULL, TG_TABLE_NAME,
      (row_to_json(NEW)->>'id')::uuid,
      TG_OP, false,
      CASE WHEN v_enforce THEN 'strict' ELSE 'audit' END,
      auth.uid(),
      to_jsonb(NEW),
      'direct_write_bypassed_gateway'
    );

    IF v_enforce THEN
      RAISE EXCEPTION 'NOTES-SINGLE-DOOR: direct writes on % are forbidden. Use rpc_account_journal_write.', TG_TABLE_NAME
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_notes_single_door_cal ON public.client_activity_logs;
CREATE TRIGGER tg_notes_single_door_cal
  BEFORE INSERT ON public.client_activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

DROP TRIGGER IF EXISTS tg_notes_single_door_al ON public.activity_logs;
CREATE TRIGGER tg_notes_single_door_al
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

DROP TRIGGER IF EXISTS tg_notes_single_door_cin ON public.client_internal_notes;
CREATE TRIGGER tg_notes_single_door_cin
  BEFORE INSERT ON public.client_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

DROP TRIGGER IF EXISTS tg_notes_single_door_af ON public.account_followups;
CREATE TRIGGER tg_notes_single_door_af
  BEFORE INSERT ON public.account_followups
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

DROP TRIGGER IF EXISTS tg_notes_single_door_osh ON public.order_status_history;
CREATE TRIGGER tg_notes_single_door_osh
  BEFORE INSERT ON public.order_status_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

DROP TRIGGER IF EXISTS tg_notes_single_door_oin ON public.order_internal_notes;
CREATE TRIGGER tg_notes_single_door_oin
  BEFORE INSERT ON public.order_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_notes_single_door();

-- 8) Wrapper RPC that flags the gateway session (used by the canonical RPC)
CREATE OR REPLACE FUNCTION public.rpc_account_journal_write(
  p_target_table TEXT,
  p_payload JSONB,
  p_event_key TEXT,
  p_correlation_id UUID,
  p_gateway_marker BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.journal_gateway','on', true);
  RETURN public.rpc_account_journal_write(p_target_table, p_payload, p_event_key, p_correlation_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_account_journal_write(TEXT, JSONB, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

-- Also flag gateway inside the main RPC by wrapping via SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.rpc_account_journal_write(
  p_target_table TEXT,
  p_payload JSONB,
  p_event_key TEXT DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_event_key TEXT := p_event_key;
  v_correlation_id UUID := COALESCE(p_correlation_id, gen_random_uuid());
  v_new_id UUID;
  v_existing JSONB;
  v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_client_id UUID;
  v_account_id UUID;
  v_order_id UUID;
BEGIN
  PERFORM set_config('app.journal_gateway','on', true);

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL-401: authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_event_key IS NOT NULL THEN
    SELECT result INTO v_existing
      FROM public.account_journal_idempotency
      WHERE event_key = v_event_key
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'result', v_existing);
    END IF;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
    p.email
    INTO v_actor_name, v_actor_email
    FROM public.profiles p WHERE p.id = v_actor_user_id;

  SELECT ur.role::text INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor_user_id
    ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 9 END
    LIMIT 1;
  v_actor_role := COALESCE(v_actor_role, 'authenticated');

  v_client_id  := NULLIF(v_payload->>'client_id','')::uuid;
  v_account_id := NULLIF(v_payload->>'account_id','')::uuid;
  v_order_id   := NULLIF(v_payload->>'order_id','')::uuid;

  IF p_target_table NOT IN (
    'client_activity_logs','activity_logs','client_internal_notes',
    'account_followups','order_status_history','order_internal_notes'
  ) THEN
    RAISE EXCEPTION 'JOURNAL-400: target_table % not allowed', p_target_table USING ERRCODE = '22023';
  END IF;

  IF p_target_table = 'client_activity_logs' THEN
    INSERT INTO public.client_activity_logs(
      client_id, actor_user_id, actor_name, actor_role,
      action_type, entity_type, entity_id, summary,
      before_data, after_data, correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_actor_user_id, v_actor_name, v_actor_role,
      COALESCE(v_payload->>'action_type','note'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      v_payload->>'summary',
      v_payload->'before_data', v_payload->'after_data',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'activity_logs' THEN
    INSERT INTO public.activity_logs(
      user_id, action, entity_type, entity_id, details,
      actor_role, actor_name, actor_email,
      changed_field, reason, old_value, new_value,
      correlation_id, event_key, metadata
    ) VALUES (
      v_actor_user_id,
      COALESCE(v_payload->>'action','write'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      COALESCE(v_payload->'details','{}'::jsonb),
      v_actor_role, v_actor_name, v_actor_email,
      v_payload->>'changed_field', v_payload->>'reason',
      v_payload->>'old_value', v_payload->>'new_value',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'client_internal_notes' THEN
    INSERT INTO public.client_internal_notes(
      client_id, account_id, note_type, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      COALESCE(v_payload->>'note_type','general'),
      v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'account_followups' THEN
    INSERT INTO public.account_followups(
      client_user_id, account_id, title, description,
      category, priority, status, due_at,
      assigned_to, assigned_to_email, created_by, created_by_email,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      v_payload->>'title', v_payload->>'description',
      COALESCE(v_payload->>'category','general'),
      COALESCE(v_payload->>'priority','normal'),
      COALESCE(v_payload->>'status','open'),
      NULLIF(v_payload->>'due_at','')::timestamptz,
      NULLIF(v_payload->>'assigned_to','')::uuid,
      v_payload->>'assigned_to_email',
      v_actor_user_id, v_actor_email,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_status_history' THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_user_id, actor_role, actor_name, change_reason, metadata,
      correlation_id, event_key
    ) VALUES (
      v_order_id, v_payload->>'status_domain',
      v_payload->>'old_status', v_payload->>'new_status',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_payload->>'change_reason',
      COALESCE(v_payload->'metadata','{}'::jsonb),
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_internal_notes' THEN
    INSERT INTO public.order_internal_notes(
      order_id, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_order_id, v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;
  END IF;

  IF v_event_key IS NOT NULL THEN
    INSERT INTO public.account_journal_idempotency(
      event_key, target_table, target_id, correlation_id, actor_user_id, result
    ) VALUES (
      v_event_key, p_target_table, v_new_id, v_correlation_id, v_actor_user_id,
      jsonb_build_object('id', v_new_id)
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  INSERT INTO public.account_journal_audit_log(
    correlation_id, event_key, target_table, target_id, operation,
    via_gateway, enforcement_mode,
    actor_user_id, actor_role, actor_name,
    client_id, account_id, order_id, payload
  ) VALUES (
    v_correlation_id, v_event_key, p_target_table, v_new_id, 'WRITE',
    true, 'audit',
    v_actor_user_id, v_actor_role, v_actor_name,
    v_client_id, v_account_id, v_order_id, v_payload
  );

  RETURN jsonb_build_object(
    'ok', true, 'id', v_new_id,
    'correlation_id', v_correlation_id,
    'event_key', v_event_key
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_account_journal_write(TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;
