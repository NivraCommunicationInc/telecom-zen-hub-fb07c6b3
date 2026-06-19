-- BUG C6: Remove duplicate cron jobs for noc-monitor and revenue-assurance.
--
-- History:
--   20260611000002 created 'noc-monitor-every-30min'  (vault auth)
--   20260611000004 created 'revenue-assurance-daily'  (vault auth, 09:00)
--   20260612000015 created 'noc-monitor' + 'revenue-assurance' (no auth, 03:30)
--
-- Result on fresh DB: 4 active jobs for 2 functions.
-- Fix: unschedule all variants, recreate 2 canonical jobs with vault auth.

SELECT cron.unschedule('noc-monitor')              WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'noc-monitor');
SELECT cron.unschedule('noc-monitor-every-30min')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'noc-monitor-every-30min');
SELECT cron.unschedule('revenue-assurance')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-assurance');
SELECT cron.unschedule('revenue-assurance-daily')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-assurance-daily');

SELECT cron.schedule(
  'noc-monitor',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/noc-monitor',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

SELECT cron.schedule(
  'revenue-assurance',
  '30 3 * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/revenue-assurance',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);
