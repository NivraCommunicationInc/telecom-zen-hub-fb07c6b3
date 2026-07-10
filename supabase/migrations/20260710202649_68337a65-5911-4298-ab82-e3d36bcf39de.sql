
-- ============================================================================
-- Module 38 — Phase A : Privacy Requests Loi 25 hardening
-- Single Door + Immutability + State Machine + Idempotency + Transactional RPC
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend privacy_requests with hardening columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.privacy_requests
  ADD COLUMN IF NOT EXISTS idempotency_key   TEXT,
  ADD COLUMN IF NOT EXISTS description_hash  TEXT,
  ADD COLUMN IF NOT EXISTS request_ip        INET,
  ADD COLUMN IF NOT EXISTS request_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS created_by_role   TEXT,
  ADD COLUMN IF NOT EXISTS state_transitions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS ux_privacy_requests_idempotency_key
  ON public.privacy_requests(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_privacy_requests_status
  ON public.privacy_requests(status);

-- ---------------------------------------------------------------------------
-- 2. Drop legacy authenticated INSERT/UPDATE policies (Single Door enforcement)
--    SELECT policy remains, extended to kyc_agent + billing_admin.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can create privacy requests" ON public.privacy_requests;
DROP POLICY IF EXISTS "Staff can update privacy requests" ON public.privacy_requests;
DROP POLICY IF EXISTS "Staff can view privacy requests"   ON public.privacy_requests;

CREATE POLICY "Staff can view privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'kyc_agent'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  );

-- ---------------------------------------------------------------------------
-- 3. Guard trigger — Single Door + Immutability + DELETE block
--    Bypass is transaction-scoped only (SET LOCAL). No session/role bypass.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_privacy_requests_guard_iud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass TEXT;
BEGIN
  v_bypass := current_setting('privacy.bypass', true);

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PRIVACY-REQ-DELETE-FORBIDDEN: privacy_requests is append-only (Loi 25).';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_bypass IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'PRIVACY-REQ-SINGLE-DOOR: direct INSERT forbidden. Use rpc_privacy_request_create.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_bypass IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'PRIVACY-REQ-SINGLE-DOOR: direct UPDATE forbidden. Use rpc_privacy_request_update_status.';
    END IF;

    -- Immutable columns (Loi 25 legal evidence)
    IF NEW.client_id          IS DISTINCT FROM OLD.client_id          THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: client_id'; END IF;
    IF NEW.request_type       IS DISTINCT FROM OLD.request_type       THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: request_type'; END IF;
    IF NEW.description        IS DISTINCT FROM OLD.description        THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: description'; END IF;
    IF NEW.description_hash   IS DISTINCT FROM OLD.description_hash   THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: description_hash'; END IF;
    IF NEW.received_at        IS DISTINCT FROM OLD.received_at        THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: received_at'; END IF;
    IF NEW.due_at             IS DISTINCT FROM OLD.due_at             THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: due_at'; END IF;
    IF NEW.created_by         IS DISTINCT FROM OLD.created_by         THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: created_by'; END IF;
    IF NEW.created_by_email   IS DISTINCT FROM OLD.created_by_email   THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: created_by_email'; END IF;
    IF NEW.created_by_role    IS DISTINCT FROM OLD.created_by_role    THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: created_by_role'; END IF;
    IF NEW.request_ip         IS DISTINCT FROM OLD.request_ip         THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: request_ip'; END IF;
    IF NEW.request_user_agent IS DISTINCT FROM OLD.request_user_agent THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: request_user_agent'; END IF;
    IF NEW.idempotency_key    IS DISTINCT FROM OLD.idempotency_key    THEN RAISE EXCEPTION 'PRIVACY-REQ-IMMUTABLE: idempotency_key'; END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_privacy_requests_guard_iud ON public.privacy_requests;
CREATE TRIGGER trg_privacy_requests_guard_iud
  BEFORE INSERT OR UPDATE OR DELETE ON public.privacy_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_privacy_requests_guard_iud();

-- ---------------------------------------------------------------------------
-- 4. State machine trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_privacy_requests_state_machine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT := OLD.status;
  v_to   TEXT := NEW.status;
  v_ok   BOOLEAN := FALSE;
BEGIN
  IF v_from IS NOT DISTINCT FROM v_to THEN
    RETURN NEW;
  END IF;

  IF v_from = 'received' AND v_to IN ('in_review','awaiting_client','cancelled') THEN
    v_ok := TRUE;
  ELSIF v_from = 'in_review' AND v_to IN ('awaiting_client','completed','refused','cancelled') THEN
    v_ok := TRUE;
  ELSIF v_from = 'awaiting_client' AND v_to IN ('in_review','completed','refused','cancelled') THEN
    v_ok := TRUE;
  ELSIF v_from IN ('completed','refused','cancelled') THEN
    v_ok := FALSE; -- terminal states
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'PRIVACY-REQ-STATE-INVALID: transition % -> % not allowed', v_from, v_to;
  END IF;

  IF v_to = 'refused' AND (NEW.refusal_reason IS NULL OR btrim(NEW.refusal_reason) = '') THEN
    RAISE EXCEPTION 'PRIVACY-REQ-REFUSAL-REASON-REQUIRED: refusal_reason must be provided for refused status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_privacy_requests_state_machine ON public.privacy_requests;
CREATE TRIGGER trg_privacy_requests_state_machine
  BEFORE UPDATE ON public.privacy_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_privacy_requests_state_machine();

-- ---------------------------------------------------------------------------
-- 5. RPC — Create (transactional: privacy_requests + admin_audit_log + email_queue)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_privacy_request_create(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller           uuid := auth.uid();
  v_caller_email     TEXT;
  v_caller_role      TEXT;
  v_client_id        uuid;
  v_account_id       uuid;
  v_request_type     TEXT;
  v_description      TEXT;
  v_internal_notes   TEXT;
  v_reason           TEXT;
  v_idempotency_key  TEXT;
  v_request_ip       INET;
  v_ua               TEXT;
  v_existing         public.privacy_requests%ROWTYPE;
  v_row              public.privacy_requests%ROWTYPE;
  v_client_email     TEXT;
  v_desc_hash        TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PRIVACY-REQ-AUTH: authentication required';
  END IF;

  -- RBAC check (staff roles only)
  IF NOT (
       public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'employee'::app_role)
    OR public.has_role(v_caller, 'supervisor'::app_role)
    OR public.has_role(v_caller, 'support'::app_role)
    OR public.has_role(v_caller, 'kyc_agent'::app_role)
    OR public.has_role(v_caller, 'billing_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'PRIVACY-REQ-RBAC: insufficient privileges';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller;

  v_caller_role := CASE
    WHEN public.has_role(v_caller,'admin'::app_role)         THEN 'admin'
    WHEN public.has_role(v_caller,'supervisor'::app_role)    THEN 'supervisor'
    WHEN public.has_role(v_caller,'support'::app_role)       THEN 'support'
    WHEN public.has_role(v_caller,'kyc_agent'::app_role)     THEN 'kyc_agent'
    WHEN public.has_role(v_caller,'billing_admin'::app_role) THEN 'billing_admin'
    WHEN public.has_role(v_caller,'employee'::app_role)      THEN 'employee'
    ELSE 'staff'
  END;

  -- Parse payload
  v_client_id       := NULLIF(p_payload->>'client_id','')::uuid;
  v_account_id      := NULLIF(p_payload->>'account_id','')::uuid;
  v_request_type    := lower(btrim(COALESCE(p_payload->>'request_type','')));
  v_description     := btrim(COALESCE(p_payload->>'description',''));
  v_internal_notes  := NULLIF(btrim(COALESCE(p_payload->>'internal_notes','')),'');
  v_reason          := btrim(COALESCE(p_payload->>'reason',''));
  v_idempotency_key := NULLIF(btrim(COALESCE(p_payload->>'idempotency_key','')),'');
  v_request_ip      := NULLIF(p_payload->>'request_ip','')::inet;
  v_ua              := NULLIF(btrim(COALESCE(p_payload->>'user_agent','')),'');

  -- Normalize legacy alias 'submitted' -> not accepted at DB layer; caller must send received.
  -- (EF handles alias normalization before invoking this RPC.)

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: client_id required'; END IF;
  IF v_request_type NOT IN ('access','rectification','deletion','portability','withdrawal_consent','complaint') THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: request_type invalid';
  END IF;
  IF length(v_description) = 0 OR length(v_description) > 5000 THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: description length invalid (1..5000)';
  END IF;
  IF length(v_reason) = 0 OR length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: reason length invalid (1..2000)';
  END IF;
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: idempotency_key required';
  END IF;

  -- Idempotence: same key = same result
  SELECT * INTO v_existing FROM public.privacy_requests WHERE idempotency_key = v_idempotency_key FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'request', to_jsonb(v_existing));
  END IF;

  v_desc_hash := encode(digest(v_description, 'sha256'), 'hex');

  -- Transactional bypass (scoped to this transaction only)
  PERFORM set_config('privacy.bypass','on', true);

  INSERT INTO public.privacy_requests (
    client_id, account_id, request_type, description, internal_notes,
    created_by, created_by_email, created_by_role,
    last_updated_by, last_updated_by_email,
    idempotency_key, description_hash, request_ip, request_user_agent,
    state_transitions
  ) VALUES (
    v_client_id, v_account_id, v_request_type, v_description, v_internal_notes,
    v_caller, v_caller_email, v_caller_role,
    v_caller, v_caller_email,
    v_idempotency_key, v_desc_hash, v_request_ip, v_ua,
    jsonb_build_array(jsonb_build_object(
      'from', null, 'to', 'received',
      'actor', v_caller, 'actor_email', v_caller_email, 'actor_role', v_caller_role,
      'reason', v_reason, 'at', now()
    ))
  )
  RETURNING * INTO v_row;

  -- Audit log (same transaction)
  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, action, target_type, target_id, details
  ) VALUES (
    v_caller, v_caller_email, 'privacy.request.create',
    'privacy_request', v_row.id,
    jsonb_build_object(
      'client_id', v_client_id,
      'request_type', v_request_type,
      'reason', v_reason,
      'idempotency_key', v_idempotency_key,
      'before', null,
      'after', to_jsonb(v_row) - 'description'
    )
  );

  -- Email accusé de réception (client) — same transaction
  SELECT email INTO v_client_email FROM auth.users WHERE id = v_client_id;
  IF v_client_email IS NOT NULL THEN
    INSERT INTO public.email_queue (
      event_key, template_key, template_vars,
      entity_type, entity_id, to_email, language, priority, status, idempotency_key
    ) VALUES (
      'privacy.request.received',
      'privacy_request_received',
      jsonb_build_object(
        'request_type', v_request_type,
        'due_at', v_row.due_at,
        'request_id', v_row.id
      ),
      'privacy_request', v_row.id, v_client_email, 'fr', 5, 'pending',
      'pr-received-' || v_row.id::text
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'request', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_privacy_request_create(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_privacy_request_create(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC — Update status (transactional)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_privacy_request_update_status(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid := auth.uid();
  v_caller_email    TEXT;
  v_caller_role     TEXT;
  v_request_id      uuid;
  v_new_status      TEXT;
  v_reason          TEXT;
  v_refusal_reason  TEXT;
  v_internal_notes  TEXT;
  v_idempotency_key TEXT;
  v_before          public.privacy_requests%ROWTYPE;
  v_after           public.privacy_requests%ROWTYPE;
  v_client_email    TEXT;
  v_transition      jsonb;
  v_dup_audit       INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PRIVACY-REQ-AUTH: authentication required';
  END IF;

  IF NOT (
       public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'employee'::app_role)
    OR public.has_role(v_caller, 'supervisor'::app_role)
    OR public.has_role(v_caller, 'support'::app_role)
    OR public.has_role(v_caller, 'kyc_agent'::app_role)
    OR public.has_role(v_caller, 'billing_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'PRIVACY-REQ-RBAC: insufficient privileges';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller;

  v_caller_role := CASE
    WHEN public.has_role(v_caller,'admin'::app_role)         THEN 'admin'
    WHEN public.has_role(v_caller,'supervisor'::app_role)    THEN 'supervisor'
    WHEN public.has_role(v_caller,'support'::app_role)       THEN 'support'
    WHEN public.has_role(v_caller,'kyc_agent'::app_role)     THEN 'kyc_agent'
    WHEN public.has_role(v_caller,'billing_admin'::app_role) THEN 'billing_admin'
    WHEN public.has_role(v_caller,'employee'::app_role)      THEN 'employee'
    ELSE 'staff'
  END;

  v_request_id      := NULLIF(p_payload->>'request_id','')::uuid;
  v_new_status      := lower(btrim(COALESCE(p_payload->>'status','')));
  v_reason          := btrim(COALESCE(p_payload->>'reason',''));
  v_refusal_reason  := NULLIF(btrim(COALESCE(p_payload->>'refusal_reason','')),'');
  v_internal_notes  := NULLIF(btrim(COALESCE(p_payload->>'internal_notes','')),'');
  v_idempotency_key := NULLIF(btrim(COALESCE(p_payload->>'idempotency_key','')),'');

  IF v_request_id IS NULL THEN RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: request_id required'; END IF;
  IF v_new_status NOT IN ('received','in_review','awaiting_client','completed','refused','cancelled') THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: status invalid';
  END IF;
  IF length(v_reason) = 0 OR length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: reason length invalid (1..2000)';
  END IF;
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'PRIVACY-REQ-VALIDATION: idempotency_key required';
  END IF;

  -- Idempotence check via audit log
  SELECT COUNT(*) INTO v_dup_audit
    FROM public.admin_audit_log
   WHERE action = 'privacy.request.update_status'
     AND target_id = v_request_id
     AND details->>'idempotency_key' = v_idempotency_key;

  IF v_dup_audit > 0 THEN
    SELECT * INTO v_after FROM public.privacy_requests WHERE id = v_request_id;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'request', to_jsonb(v_after));
  END IF;

  SELECT * INTO v_before FROM public.privacy_requests WHERE id = v_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRIVACY-REQ-NOT-FOUND: request_id % not found', v_request_id;
  END IF;

  v_transition := jsonb_build_object(
    'from', v_before.status, 'to', v_new_status,
    'actor', v_caller, 'actor_email', v_caller_email, 'actor_role', v_caller_role,
    'reason', v_reason, 'at', now()
  );

  PERFORM set_config('privacy.bypass','on', true);

  UPDATE public.privacy_requests
     SET status                = v_new_status,
         refusal_reason        = CASE WHEN v_new_status = 'refused' THEN v_refusal_reason ELSE refusal_reason END,
         internal_notes        = CASE
                                   WHEN v_internal_notes IS NOT NULL AND internal_notes IS NULL THEN v_internal_notes
                                   WHEN v_internal_notes IS NOT NULL THEN internal_notes || E'\n---\n' || v_internal_notes
                                   ELSE internal_notes
                                 END,
         completed_at          = CASE WHEN v_new_status IN ('completed','refused','cancelled') THEN now() ELSE completed_at END,
         last_updated_by       = v_caller,
         last_updated_by_email = v_caller_email,
         state_transitions     = state_transitions || v_transition
   WHERE id = v_request_id
   RETURNING * INTO v_after;

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, action, target_type, target_id, details
  ) VALUES (
    v_caller, v_caller_email, 'privacy.request.update_status',
    'privacy_request', v_request_id,
    jsonb_build_object(
      'idempotency_key', v_idempotency_key,
      'reason', v_reason,
      'from', v_before.status,
      'to', v_new_status,
      'before', to_jsonb(v_before) - 'description',
      'after',  to_jsonb(v_after)  - 'description'
    )
  );

  -- Send email on terminal transitions
  IF v_new_status IN ('completed','refused') THEN
    SELECT email INTO v_client_email FROM auth.users WHERE id = v_after.client_id;
    IF v_client_email IS NOT NULL THEN
      INSERT INTO public.email_queue (
        event_key, template_key, template_vars,
        entity_type, entity_id, to_email, language, priority, status, idempotency_key
      ) VALUES (
        'privacy.request.' || v_new_status,
        'privacy_request_' || v_new_status,
        jsonb_build_object(
          'request_type', v_after.request_type,
          'request_id', v_after.id,
          'refusal_reason', v_after.refusal_reason
        ),
        'privacy_request', v_after.id, v_client_email, 'fr', 5, 'pending',
        'pr-' || v_new_status || '-' || v_after.id::text || '-' || v_idempotency_key
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'request', to_jsonb(v_after));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_privacy_request_update_status(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_privacy_request_update_status(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Grants recheck (defense-in-depth; do not grant to anon)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.privacy_requests FROM anon;
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
