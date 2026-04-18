
-- Restrict insert to authenticated admin role only (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can insert retention logs" ON public.data_retention_log;

CREATE POLICY "Only admins can insert retention logs"
  ON public.data_retention_log FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
