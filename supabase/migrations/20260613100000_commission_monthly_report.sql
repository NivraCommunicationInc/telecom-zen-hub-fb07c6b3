-- commission-monthly-report infrastructure
-- 1. Storage bucket "reports" (private, admin-only)
-- 2. pg_cron job: 1st of each month at 08:00 UTC

-- ── Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50 MB max
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Admin read/write
CREATE POLICY "Admins can manage reports"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  );

-- Service role can upload (edge functions run as service role)
CREATE POLICY "Service role can upload reports"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'reports');

CREATE POLICY "Service role can update reports"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'reports');

-- ── pg_cron: 1st of each month at 08:00 UTC ────────────────────────────────
-- Requires: pg_cron + pg_net (available on Supabase Pro)
-- Calls commission-monthly-report with no params → auto-uses previous month

SELECT cron.schedule(
  'commission-monthly-report',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/commission-monthly-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{}'::jsonb
  );
  $$
);
