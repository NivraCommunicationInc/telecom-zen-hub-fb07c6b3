-- Schedule process-document-jobs to run every 60 seconds
-- This makes document generation 100% autonomous (no staff browser dependency)
SELECT cron.schedule(
  'process-document-jobs-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/process-document-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '"}')::jsonb
  ) AS request_id;
  $cron$
);