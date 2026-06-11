-- Revenue Assurance — pg_cron schedule
-- Runs daily at 09:00 UTC (05:00 EST)
-- Requires pg_cron + pg_net (enabled on Supabase Pro)

SELECT cron.schedule(
  'revenue-assurance-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/revenue-assurance',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{}'::jsonb
  );
  $$
);
