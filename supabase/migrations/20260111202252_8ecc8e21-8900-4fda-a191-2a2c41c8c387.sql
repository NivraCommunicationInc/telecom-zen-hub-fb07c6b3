-- ==============================================================================
-- P0 SECURITY FIX PART 3: Re-enable RLS with proper service_role policies
-- ==============================================================================

-- Re-enable RLS on security tables
ALTER TABLE public.admin_access_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_email_allowlist ENABLE ROW LEVEL SECURITY;

-- Create proper policies that allow service_role full access but block authenticated/anon
-- Note: service_role bypasses RLS by default, but we add explicit policies for clarity

-- admin_access_limits: No access for authenticated/anon (service_role bypasses RLS)
CREATE POLICY "Block all non-service access" ON public.admin_access_limits
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- security_events: No access for authenticated/anon (service_role bypasses RLS)
CREATE POLICY "Block all non-service access" ON public.security_events
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- staff_email_allowlist: No access for authenticated/anon (service_role bypasses RLS)
CREATE POLICY "Block all non-service access" ON public.staff_email_allowlist
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Add a comment explaining the security model
COMMENT ON TABLE public.admin_access_limits IS 'Internal security table - only accessible via service_role (edge functions). RLS blocks authenticated/anon.';
COMMENT ON TABLE public.security_events IS 'Security audit log - only accessible via service_role (edge functions). RLS blocks authenticated/anon.';
COMMENT ON TABLE public.staff_email_allowlist IS 'Bootstrap allowlist for initial admin setup - only accessible via service_role. RLS blocks authenticated/anon.';

-- Log this fix
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'SECURITY_FIX_V3_APPLIED',
  'info',
  jsonb_build_object(
    'fix_id', 'P0_2026-01-11_v3',
    'description', 'Re-enabled RLS on security tables with proper blocking policies',
    'changes', ARRAY[
      'Enabled RLS on admin_access_limits, security_events, staff_email_allowlist',
      'Added blocking policies for authenticated/anon roles',
      'service_role bypasses RLS by default so edge functions still work'
    ]
  )
);