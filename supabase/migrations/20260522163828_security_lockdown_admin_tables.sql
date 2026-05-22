-- ==============================================================================
-- SECURITY: Re-enable RLS on internal security tables with deny-all policies
-- ==============================================================================
-- Background: A previous migration (20260111202233) disabled RLS on three
-- internal security tables on the assumption that only service_role would
-- ever query them. However, by default Supabase grants SELECT to the anon
-- and authenticated roles on every table in the public schema, so with RLS
-- disabled those tables become readable by anyone. This migration re-enables
-- RLS and installs a deny-all policy, which still allows service_role to
-- access the tables (it bypasses RLS) while blocking client roles entirely.
-- ==============================================================================

-- admin_access_limits — controls max admin/staff seat counts
ALTER TABLE public.admin_access_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all client access" ON public.admin_access_limits;
CREATE POLICY "Deny all client access"
  ON public.admin_access_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- security_events — sensitive security audit log
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all client access" ON public.security_events;
CREATE POLICY "Deny all client access"
  ON public.security_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- staff_email_allowlist — privileged email bootstrap list
ALTER TABLE public.staff_email_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all client access" ON public.staff_email_allowlist;
CREATE POLICY "Deny all client access"
  ON public.staff_email_allowlist
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Log this fix
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'SECURITY_FIX_RLS_LOCKDOWN',
  'info',
  jsonb_build_object(
    'description', 'Re-enabled RLS with deny-all policies on internal security tables',
    'tables', ARRAY['admin_access_limits', 'security_events', 'staff_email_allowlist'],
    'applied_at', now()
  )
);
