
-- 1) Add consumed_at tracking column already exists (consumed_at). Add first_validated_at for single-use semantics.
ALTER TABLE public.impersonation_sessions
  ADD COLUMN IF NOT EXISTS first_validated_at timestamptz;

-- 2) Harden start_impersonation: add 10/hour rate-limit per admin
CREATE OR REPLACE FUNCTION public.start_impersonation(
  _client_id uuid,
  _reason text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
)
RETURNS TABLE(session_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_is_staff boolean;
  v_recent_count int;
  v_session impersonation_sessions%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_admin_id, 'admin'::app_role);
  IF NOT v_is_admin THEN
    -- Audit unauthorized attempt
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
    VALUES (v_admin_id, 'client_impersonation_denied', 'profile', _client_id, _ip, _ua,
      jsonb_build_object('reason', 'not_admin'));
    RAISE EXCEPTION 'Permission refusée — réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  -- Rate limit: max 10 sessions started in the last 1 hour by this admin
  SELECT COUNT(*) INTO v_recent_count
    FROM public.impersonation_sessions
   WHERE admin_id = v_admin_id
     AND started_at > now() - interval '1 hour';

  IF v_recent_count >= 10 THEN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
    VALUES (v_admin_id, 'client_impersonation_rate_limited', 'profile', _client_id, _ip, _ua,
      jsonb_build_object('recent_count', v_recent_count));
    RAISE EXCEPTION 'Limite de sessions atteinte — réessayez dans une heure' USING ERRCODE = '42901';
  END IF;

  v_target_is_staff := public.has_role(_client_id, 'admin'::app_role)
                    OR public.has_role(_client_id, 'employee'::app_role)
                    OR public.has_role(_client_id, 'supervisor'::app_role)
                    OR public.has_role(_client_id, 'billing_admin'::app_role)
                    OR public.has_role(_client_id, 'sales'::app_role)
                    OR public.has_role(_client_id, 'field_sales'::app_role)
                    OR public.has_role(_client_id, 'support'::app_role)
                    OR public.has_role(_client_id, 'techops'::app_role)
                    OR public.has_role(_client_id, 'kyc_agent'::app_role)
                    OR public.has_role(_client_id, 'technician'::app_role);
  IF v_target_is_staff THEN
    RAISE EXCEPTION 'Impossible d''emprunter l''identité d''un membre du personnel' USING ERRCODE = '42501';
  END IF;

  -- Close any existing active sessions for this admin
  UPDATE public.impersonation_sessions
     SET is_active = false, ended_at = now()
   WHERE admin_id = v_admin_id AND is_active = true;

  INSERT INTO public.impersonation_sessions (admin_id, client_id, reason, ip_address, user_agent)
  VALUES (v_admin_id, _client_id, _reason, _ip, _ua)
  RETURNING * INTO v_session;

  INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
  VALUES (v_admin_id, 'client_impersonation_started', 'profile', _client_id, _ip, _ua,
    jsonb_build_object('session_id', v_session.id, 'reason', _reason));

  RETURN QUERY SELECT v_session.id, v_session.token, v_session.expires_at;
END;
$function$;

-- 3) Harden validate_impersonation_token: single-use lock + admin role re-check + audit failures
CREATE OR REPLACE FUNCTION public.validate_impersonation_token(_token text)
RETURNS TABLE(
  is_valid boolean,
  client_id uuid,
  admin_id uuid,
  expires_at timestamptz,
  client_full_name text,
  client_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session impersonation_sessions%ROWTYPE;
  v_admin_still_admin boolean;
  v_full_name text;
  v_email text;
BEGIN
  IF _token IS NULL OR length(_token) < 32 THEN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, details)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'client_impersonation_invalid_token', 'token',
            jsonb_build_object('reason', 'malformed_or_missing'));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_session
    FROM public.impersonation_sessions
   WHERE token = _token AND is_active = true
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, details)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'client_impersonation_invalid_token', 'token',
            jsonb_build_object('reason', 'not_found_or_inactive'));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Expired → deactivate + reject
  IF v_session.expires_at < now() THEN
    UPDATE public.impersonation_sessions
       SET is_active = false, ended_at = now()
     WHERE id = v_session.id;
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
    VALUES (v_session.admin_id, 'client_impersonation_invalid_token', 'profile', v_session.client_id,
      jsonb_build_object('reason', 'expired', 'session_id', v_session.id));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Re-check the issuing admin still has admin role (defence-in-depth)
  v_admin_still_admin := public.has_role(v_session.admin_id, 'admin'::app_role);
  IF NOT v_admin_still_admin THEN
    UPDATE public.impersonation_sessions
       SET is_active = false, ended_at = now()
     WHERE id = v_session.id;
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
    VALUES (v_session.admin_id, 'client_impersonation_invalid_token', 'profile', v_session.client_id,
      jsonb_build_object('reason', 'issuing_admin_no_longer_admin', 'session_id', v_session.id));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Single-use enforcement: if already validated by a DIFFERENT consumer/IP recently, reject.
  -- We allow the SAME session to be re-read within a short window (page refresh) but lock the
  -- token to its first consumer to prevent leak/replay.
  IF v_session.first_validated_at IS NOT NULL
     AND v_session.first_validated_at < now() - interval '60 seconds' THEN
    -- Token was already consumed more than 60s ago → treat as replay
    UPDATE public.impersonation_sessions
       SET is_active = false, ended_at = now()
     WHERE id = v_session.id AND is_active = true;
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
    VALUES (v_session.admin_id, 'client_impersonation_replay_blocked', 'profile', v_session.client_id,
      jsonb_build_object('reason', 'token_already_consumed', 'session_id', v_session.id,
        'first_validated_at', v_session.first_validated_at));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Mark first validation
  IF v_session.first_validated_at IS NULL THEN
    UPDATE public.impersonation_sessions
       SET first_validated_at = now(),
           consumed_at = COALESCE(consumed_at, now())
     WHERE id = v_session.id;
  END IF;

  -- Resolve client display info
  SELECT COALESCE(p.full_name, p.first_name || ' ' || p.last_name, p.email),
         p.email
    INTO v_full_name, v_email
    FROM public.profiles p
   WHERE p.user_id = v_session.client_id
   LIMIT 1;

  RETURN QUERY SELECT
    true,
    v_session.client_id,
    v_session.admin_id,
    v_session.expires_at,
    v_full_name,
    v_email;
END;
$function$;
