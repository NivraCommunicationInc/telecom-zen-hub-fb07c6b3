CREATE OR REPLACE FUNCTION public.start_impersonation(_client_id uuid, _reason text DEFAULT NULL::text, _ip text DEFAULT NULL::text, _ua text DEFAULT NULL::text)
RETURNS TABLE(session_id uuid, token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_authorized boolean;
  v_target_is_staff boolean;
  v_recent_count int;
  v_session impersonation_sessions%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  v_is_authorized := public.has_role(v_admin_id, 'admin'::app_role)
                  OR public.has_role(v_admin_id, 'employee'::app_role)
                  OR public.has_role(v_admin_id, 'field_sales'::app_role);
  IF NOT v_is_authorized THEN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
    VALUES (v_admin_id, 'client_impersonation_denied', 'profile', _client_id, _ip, _ua,
      jsonb_build_object('reason', 'not_authorized'));
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_recent_count
    FROM public.impersonation_sessions
   WHERE admin_id = v_admin_id
     AND started_at > now() - interval '1 hour';

  IF v_recent_count >= 30 THEN
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
    RAISE EXCEPTION 'Impossible de se connecter en tant qu''employé' USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.start_impersonation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_impersonation(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_impersonation_token(_token text)
RETURNS TABLE(is_valid boolean, client_id uuid, admin_id uuid, expires_at timestamp with time zone, client_full_name text, client_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session impersonation_sessions%ROWTYPE;
  v_actor_still_authorized boolean;
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

  v_actor_still_authorized := public.has_role(v_session.admin_id, 'admin'::app_role)
                           OR public.has_role(v_session.admin_id, 'employee'::app_role)
                           OR public.has_role(v_session.admin_id, 'field_sales'::app_role);
  IF NOT v_actor_still_authorized THEN
    UPDATE public.impersonation_sessions
       SET is_active = false, ended_at = now()
     WHERE id = v_session.id;
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
    VALUES (v_session.admin_id, 'client_impersonation_invalid_token', 'profile', v_session.client_id,
      jsonb_build_object('reason', 'issuing_actor_no_longer_authorized', 'session_id', v_session.id));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_session.first_validated_at IS NOT NULL
     AND v_session.first_validated_at < now() - interval '60 seconds' THEN
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

  IF v_session.first_validated_at IS NULL THEN
    UPDATE public.impersonation_sessions
       SET first_validated_at = now(),
           consumed_at = COALESCE(consumed_at, now())
     WHERE id = v_session.id;
  END IF;

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

REVOKE ALL ON FUNCTION public.validate_impersonation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_impersonation_token(text) TO anon, authenticated;