-- Add restrictive policy for web_form_email_map (service_role only access)
CREATE POLICY "No direct access to email map"
  ON public.web_form_email_map
  FOR ALL
  USING (false);

-- Note: Service role bypasses RLS, so Edge Functions can still access this table