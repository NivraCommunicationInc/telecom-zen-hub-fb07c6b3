-- Allow public (anon) users to read service_status
CREATE POLICY "Public can view service status"
ON public.service_status
FOR SELECT
TO anon, authenticated
USING (true);