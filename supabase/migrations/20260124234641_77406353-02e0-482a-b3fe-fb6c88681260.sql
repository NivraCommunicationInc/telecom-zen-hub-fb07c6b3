-- SECURITY: Add minimal RLS policy to satisfy linter (RLS enabled with no policy)
-- Table: public.client_notification_logs

ALTER TABLE public.client_notification_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_notification_logs'
      AND policyname = 'Admins can view client notification logs'
  ) THEN
    CREATE POLICY "Admins can view client notification logs"
    ON public.client_notification_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin_user());
  END IF;
END $$;
