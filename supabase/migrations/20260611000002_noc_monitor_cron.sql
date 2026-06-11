-- NOC Monitor — pg_cron schedule
-- Runs every 30 minutes, 7j/7
-- Requires pg_cron + pg_net extensions (enabled on Supabase Pro)

SELECT cron.schedule(
  'noc-monitor-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/noc-monitor',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{}'::jsonb
  );
  $$
);
