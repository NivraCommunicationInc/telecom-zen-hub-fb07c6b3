-- Fix critical gap: billing-lifecycle and billing-dunning-engine not in pg_cron.
--
-- Root causes:
--   1. billing-check-overdue is deprecated no-op (since 2026-03-22) occupying
--      01:00 UTC cron slot with zero effect on overdue/suspension/cancellation.
--   2. billing-lifecycle (J+5 suspension + J+10 cancellation) has never been
--      scheduled — no automatic suspension or lifecycle enforcement in production.
--   3. billing-dunning-engine-daily used current_setting() which has no value in
--      production pg_cron context — migration silently failed, job never appeared.
--   4. process-document-jobs code says "triggered every 60s by pg_cron" but no
--      cron job exists — PDF auto-generation never runs automatically.

-- 1. Remove deprecated no-op (billing-check-overdue is a no-op since 2026-03-22)
SELECT cron.unschedule('billing-check-overdue')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-check-overdue');

-- 2. Remove failed previous dunning attempt (used current_setting() → never worked)
SELECT cron.unschedule('billing-dunning-engine-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-dunning-engine-daily');

-- 3. Schedule billing-lifecycle at 08:00 UTC daily
--    Handles: J+5 subscription suspension, J+10 cancellation + PayPal cancel + invoice void
SELECT cron.schedule(
  'billing-lifecycle',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/billing-lifecycle',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- 4. Schedule billing-dunning-engine at 09:15 UTC daily
--    Handles: J+3 soft email, J+7 urgent email, J+14 final + suspend
--    09:15 = 15 min after billing-daily-overdue-reminders (09:00) to avoid overlap
SELECT cron.schedule(
  'billing-dunning-engine',
  '15 9 * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/billing-dunning-engine',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- 5. Schedule process-document-jobs every minute
--    Per code comment: "Triggered every 60s by pg_cron" — PDF/invoice auto-generation
SELECT cron.schedule(
  'process-document-jobs',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/process-document-jobs',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);
