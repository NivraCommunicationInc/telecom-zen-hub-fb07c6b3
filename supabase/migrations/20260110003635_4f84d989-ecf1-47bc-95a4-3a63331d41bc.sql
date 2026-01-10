-- Explicitly deny anonymous SELECT on contact_requests
-- The existing policies already restrict SELECT to admins only,
-- but adding an explicit deny makes it clearer
CREATE POLICY "Deny anonymous select on contact_requests"
ON public.contact_requests
FOR SELECT
TO anon
USING (false);