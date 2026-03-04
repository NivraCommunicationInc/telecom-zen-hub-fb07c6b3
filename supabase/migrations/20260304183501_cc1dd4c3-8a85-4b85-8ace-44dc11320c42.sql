
-- Fix RLS: add policy for notification_outbox (service role only via default)
CREATE POLICY "Service role full access" ON public.notification_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow admin to read outbox for monitoring
CREATE POLICY "Admin read outbox" ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Fix function search_path
ALTER FUNCTION public.notify_admin_kyc_doc_uploaded() SET search_path = public;
