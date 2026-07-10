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

  v_client_id       := NULLIF(p_payload->>'client_id','')::uuid;
  v_account_id      := NULLIF(p_payload->>'account_id','')::uuid;
  v_request_type    := lower(btrim(COALESCE(p_payload->>'request_type','')));
  v_description     := btrim(COALESCE(p_payload->>'description',''));
  v_internal_notes  := NULLIF(btrim(COALESCE(p_payload->>'internal_notes','')),'');
  v_reason          := btrim(COALESCE(p_payload->>'reason',''));
  v_idempotency_key := NULLIF(btrim(COALESCE(p_payload->>'idempotency_key','')),'');
  v_request_ip      := NULLIF(p_payload->>'request_ip','')::inet;
  v_ua              := NULLIF(btrim(COALESCE(p_payload->>'user_agent','')),'');

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

  SELECT * INTO v_existing FROM public.privacy_requests WHERE idempotency_key = v_idempotency_key FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'request', to_jsonb(v_existing));
  END IF;

  v_desc_hash := encode(sha256(v_description::bytea), 'hex');

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
      'privacy_request', v_row.id, v_client_email, 'fr', 5, 'queued',
      'pr-received-' || v_row.id::text
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'request', to_jsonb(v_row));
END;
$$;

-- Also fix rpc_privacy_request_update_status if it uses 'pending'
DO $mig$
DECLARE
  v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='rpc_privacy_request_update_status';
  IF v_src IS NOT NULL AND v_src ~ '''pending''' THEN
    -- replace pending status literal
    EXECUTE replace(v_src, '''pending''', '''queued''');
  END IF;
END $mig$;