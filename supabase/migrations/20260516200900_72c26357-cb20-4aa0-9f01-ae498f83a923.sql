
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
                  OR public.has_role(v_admin_id, 'employee'::app_role);
  IF NOT v_is_authorized THEN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
    VALUES (v_admin_id, 'client_impersonation_denied', 'profile', _client_id, _ip, _ua,
      jsonb_build_object('reason', 'not_authorized'));
    RAISE EXCEPTION 'Permission refusée — réservé au personnel autorisé' USING ERRCODE = '42501';
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
