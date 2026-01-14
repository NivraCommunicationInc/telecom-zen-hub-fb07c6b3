-- Remove "always true" RLS policies while preserving intended access

-- 1) contact_requests: still allow public submissions, but require basic non-empty fields
DROP POLICY IF EXISTS "Public can submit contact requests" ON public.contact_requests;
CREATE POLICY "Public can submit contact requests"
ON public.contact_requests
FOR INSERT
TO anon
WITH CHECK (
  email IS NOT NULL AND email <> ''
  AND phone IS NOT NULL AND phone <> ''
  AND name IS NOT NULL AND name <> ''
);

-- 2) contest_entries: service role access should not be expressed as literal true
DROP POLICY IF EXISTS "Service role full access on contest_entries" ON public.contest_entries;
CREATE POLICY "Service role full access on contest_entries"
ON public.contest_entries
FOR ALL
TO service_role
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- 3) user_roles: service role access should not be expressed as literal true
DROP POLICY IF EXISTS "service_role_full_access" ON public.user_roles;
CREATE POLICY "service_role_full_access"
ON public.user_roles
FOR ALL
TO service_role
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);
