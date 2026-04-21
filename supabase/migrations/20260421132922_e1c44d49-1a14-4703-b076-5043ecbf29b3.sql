DROP POLICY IF EXISTS "Service role can insert reminder logs" ON public.overdue_reminder_log;

CREATE POLICY "Service role inserts reminder logs"
ON public.overdue_reminder_log FOR INSERT
TO service_role
WITH CHECK (true);