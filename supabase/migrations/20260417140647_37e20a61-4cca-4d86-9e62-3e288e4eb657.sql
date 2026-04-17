CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  client_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  reason text,
  ip_address text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  consumed_at timestamptz,
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_token ON public.impersonation_sessions(token) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin ON public.impersonation_sessions(admin_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_client ON public.impersonation_sessions(client_id, started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_view_own_impersonations" ON public.impersonation_sessions;
CREATE POLICY "admins_view_own_impersonations"
  ON public.impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "no_direct_writes_impersonation" ON public.impersonation_sessions;
CREATE POLICY "no_direct_writes_impersonation"
  ON public.impersonation_sessions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.start_impersonation(
  _client_id uuid,
  _reason text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
)
RETURNS TABLE (session_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_is_staff boolean;
  v_session impersonation_sessions%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_admin_id, 'admin'::app_role);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission refusée — réservé aux administrateurs' USING ERRCODE = '42501';
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

  UPDATE public.impersonation_sessions
     SET is_active = false, ended_at = now()
   WHERE admin_id = v_admin_id AND is_active = true;

  INSERT INTO public.impersonation_sessions (admin_id, client_id, reason, ip_address, user_agent)
  VALUES (v_admin_id, _client_id, _reason, _ip, _ua)
  RETURNING * INTO v_session;

  INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, ip_address, user_agent, details)
  VALUES (
    v_admin_id, 'client_impersonation_started', 'profile', _client_id, _ip, _ua,
    jsonb_build_object('session_id', v_session.id, 'reason', _reason)
  );

  RETURN QUERY SELECT v_session.id, v_session.token, v_session.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_impersonation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_impersonation(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_impersonation_token(_token text)
RETURNS TABLE (
  is_valid boolean, client_id uuid, admin_id uuid, expires_at timestamptz,
  client_full_name text, client_email text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_session impersonation_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
    FROM public.impersonation_sessions
   WHERE token = _token AND is_active = true
   LIMIT 1;

  IF NOT FOUND OR v_session.expires_at < now() THEN
    IF FOUND AND v_session.expires_at < now() THEN
      UPDATE public.impersonation_sessions
         SET is_active = false, ended_at = now()
       WHERE id = v_session.id;
    END IF;
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_session.consumed_at IS NULL THEN
    UPDATE public.impersonation_sessions
       SET consumed_at = now()
     WHERE id = v_session.id;
  END IF;

  RETURN QUERY
  SELECT true, v_session.client_id, v_session.admin_id, v_session.expires_at,
    COALESCE(p.full_name, p.first_name || ' ' || p.last_name, p.email),
    p.email
  FROM public.profiles p
  WHERE p.user_id = v_session.client_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_impersonation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_impersonation_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.end_impersonation(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_session impersonation_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.impersonation_sessions
   WHERE token = _token AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.impersonation_sessions
     SET is_active = false, ended_at = now() WHERE id = v_session.id;

  INSERT INTO public.admin_security_audit (admin_user_id, action, target_type, target_id, details)
  VALUES (v_session.admin_id, 'client_impersonation_ended', 'profile', v_session.client_id,
    jsonb_build_object('session_id', v_session.id, 'duration_seconds',
      extract(epoch from (now() - v_session.started_at))::int));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.end_impersonation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_impersonation(text) TO anon, authenticated;