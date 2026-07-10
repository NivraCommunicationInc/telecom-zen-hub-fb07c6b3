
CREATE OR REPLACE FUNCTION public.debug_current_role()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT jsonb_build_object('current_user', current_user, 'session_user', session_user, 'auth_role', auth.role(), 'jwt_role', current_setting('request.jwt.claim.role', true));
$$;
GRANT EXECUTE ON FUNCTION public.debug_current_role() TO anon, authenticated, service_role;
