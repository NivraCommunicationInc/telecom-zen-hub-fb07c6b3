
-- 1) Idempotency column for reminder sends
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_scan
  ON public.appointments (scheduled_at)
  WHERE reminder_sent_at IS NULL;

-- 2) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3) Schedule the reminder scanner every 5 minutes.
--    Unschedule an older version first to keep the migration idempotent.
DO $$
DECLARE
  jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'appointment-reminder-scan-every-5min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END$$;

SELECT cron.schedule(
  'appointment-reminder-scan-every-5min',
  '*/5 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/send-appointment-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8'
      ),
      body := jsonb_build_object('trigger', 'cron', 'ts', now()::text)
    );
  $cmd$
);
