-- Schedule: billing-dunning-engine runs daily at 09:00 UTC
-- Requires pg_cron extension (enabled via Supabase dashboard)

SELECT cron.schedule(
  'billing-dunning-engine-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/billing-dunning-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
