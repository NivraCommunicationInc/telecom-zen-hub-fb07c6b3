-- pg_cron job: call support-ai-responder every 2 minutes
-- Processes tickets where ai_scheduled_at < now() AND ai_responded_at IS NULL AND status = 'open'

SELECT cron.unschedule('support-ai-responder') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'support-ai-responder'
);

SELECT cron.schedule(
  'support-ai-responder',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/support-ai-responder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"cron": true}'::jsonb
  );
  $$
);
