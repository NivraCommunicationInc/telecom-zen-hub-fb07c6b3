-- ==============================================================================
-- Public status page RLS — make service_status and resolved incidents readable
-- by anonymous visitors. The status page (/status) is the one piece of the site
-- that MUST be reachable even when a customer is logged out (and even when the
-- main app is in maintenance mode), so we add explicit anon SELECT policies.
-- ==============================================================================

-- service_status: anon + authenticated can SELECT.
-- The existing "Anyone can view service status" policy uses USING(true) without
-- a TO clause, which defaults to PUBLIC — but Supabase clients honor RLS per
-- role, so we add explicit anon access to be safe and self-documenting.
DROP POLICY IF EXISTS "Public anon can view service status" ON public.service_status;
CREATE POLICY "Public anon can view service status"
  ON public.service_status
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- service_incidents: anon can SELECT only RESOLVED incidents (existing policy
-- "Public can view resolved incident history" already does this, but it does
-- not specify a role. We add an explicit anon-targeted policy so anonymous
-- visitors of /status see the history.
DROP POLICY IF EXISTS "Public anon can view resolved incidents" ON public.service_incidents;
CREATE POLICY "Public anon can view resolved incidents"
  ON public.service_incidents
  FOR SELECT
  TO anon, authenticated
  USING (resolved_at IS NOT NULL);

-- Sanity grant — make sure the anon role can issue SELECT on these tables at
-- the grant level (RLS is the additional filter on top of the grant).
GRANT SELECT ON public.service_status TO anon;
GRANT SELECT ON public.service_incidents TO anon;
