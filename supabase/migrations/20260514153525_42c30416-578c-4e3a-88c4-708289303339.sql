
-- Staff impersonation table (separate from client impersonation_sessions)
CREATE TABLE IF NOT EXISTS public.staff_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  portal text NOT NULL CHECK (portal IN ('field','rh','technician','employee','core')),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  ip_address text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  consumed_at timestamptz,
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_staff_imp_token ON public.staff_impersonation_sessions(token) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_staff_imp_admin ON public.staff_impersonation_sessions(admin_user_id, started_at DESC);

ALTER TABLE public.staff_impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_own_staff_imp" ON public.staff_impersonation_sessions;
CREATE POLICY "admins_read_own_staff_imp" ON public.staff_impersonation_sessions
  FOR SELECT TO authenticated
  USING (admin_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "no_direct_writes_staff_imp" ON public.staff_impersonation_sessions;
CREATE POLICY "no_direct_writes_staff_imp" ON public.staff_impersonation_sessions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- start_staff_impersonation: admin-only, target must be staff
CREATE OR REPLACE FUNCTION public.start_staff_impersonation(
  _target_user_id uuid,
  _portal text,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
)
RETURNS TABLE (session_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_target_is_staff boolean;
  v_session staff_impersonation_sessions%ROWTYPE;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF _portal NOT IN ('field','rh','technician','employee','core') THEN
    RAISE EXCEPTION 'Portail invalide';
  END IF;

  v_target_is_staff := public.has_role(_target_user_id, 'admin'::app_role)
                    OR public.has_role(_target_user_id, 'employee'::app_role)
                    OR public.has_role(_target_user_id, 'supervisor'::app_role)
                    OR public.has_role(_target_user_id, 'billing_admin'::app_role)
                    OR public.has_role(_target_user_id, 'sales'::app_role)
                    OR public.has_role(_target_user_id, 'field_sales'::app_role)
                    OR public.has_role(_target_user_id, 'support'::app_role)
                    OR public.has_role(_target_user_id, 'techops'::app_role)
                    OR public.has_role(_target_user_id, 'kyc_agent'::app_role)
                    OR public.has_role(_target_user_id, 'technician'::app_role);

  IF NOT v_target_is_staff THEN
    RAISE EXCEPTION 'La cible doit être un membre du personnel';
  END IF;

  -- Close any existing open sessions from this admin
  UPDATE public.staff_impersonation_sessions
     SET is_active = false, ended_at = now()
   WHERE admin_user_id = v_admin AND is_active = true;

  INSERT INTO public.staff_impersonation_sessions
    (admin_user_id, target_user_id, portal, ip_address, user_agent)
  VALUES (v_admin, _target_user_id, _portal, _ip, _ua)
  RETURNING * INTO v_session;

  -- Audit
  BEGIN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
    VALUES (v_admin, 'staff_impersonation_started', 'profile', _target_user_id, _ip, _ua,
      jsonb_build_object('session_id', v_session.id, 'portal', _portal));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT v_session.id, v_session.token, v_session.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_staff_impersonation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_staff_impersonation(uuid, text, text, text) TO authenticated;

-- Service-role validator (used by edge function)
CREATE OR REPLACE FUNCTION public.validate_staff_impersonation_token(_token text)
RETURNS TABLE (
  is_valid boolean,
  session_id uuid,
  admin_user_id uuid,
  target_user_id uuid,
  portal text,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v staff_impersonation_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.staff_impersonation_sessions
   WHERE token = _token AND is_active = true LIMIT 1;
  IF NOT FOUND OR v.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v.consumed_at IS NULL THEN
    UPDATE public.staff_impersonation_sessions SET consumed_at = now() WHERE id = v.id;
  END IF;
  RETURN QUERY SELECT true, v.id, v.admin_user_id, v.target_user_id, v.portal, v.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_staff_impersonation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_staff_impersonation_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.end_staff_impersonation(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v staff_impersonation_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.staff_impersonation_sessions
   WHERE token = _token AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.staff_impersonation_sessions SET is_active = false, ended_at = now() WHERE id = v.id;
  BEGIN
    INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
    VALUES (v.admin_user_id, 'staff_impersonation_ended', 'profile', v.target_user_id,
      jsonb_build_object('session_id', v.id,
        'duration_seconds', extract(epoch from (now() - v.started_at))::int));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_staff_impersonation(text) TO authenticated, anon;

-- Core global settings (single-row toggles)
CREATE TABLE IF NOT EXISTS public.core_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allow_impersonation_actions boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.core_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

ALTER TABLE public.core_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "core_settings_admin_read" ON public.core_settings;
CREATE POLICY "core_settings_admin_read" ON public.core_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "core_settings_admin_write" ON public.core_settings;
CREATE POLICY "core_settings_admin_write" ON public.core_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
