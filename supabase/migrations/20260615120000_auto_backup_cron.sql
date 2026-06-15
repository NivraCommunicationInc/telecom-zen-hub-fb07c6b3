-- Backup automatique toutes les 3 jours à 4h00 UTC
-- Envoie un email complet à Nivrasolutions@gmail.com

SELECT cron.unschedule('auto-backup-every-3-days') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-backup-every-3-days'
);

SELECT cron.schedule(
  'auto-backup-every-3-days',
  '0 4 */3 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/auto-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'scheduled', true)
  );
  $$
);
