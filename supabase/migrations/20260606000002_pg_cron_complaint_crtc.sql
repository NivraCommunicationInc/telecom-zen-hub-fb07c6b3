-- ============================================================
-- P1.4 — pg_cron trigger: complaint-escalate-crtc
-- Auto-escalates complaints open 30+ days, notifies client of CCTS rights
-- ============================================================

DO $$
BEGIN
  PERFORM cron.unschedule('complaint-escalate-crtc');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Every day at 10:00 UTC (05:00 EST / 06:00 EDT)
SELECT cron.schedule(
  'complaint-escalate-crtc',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/complaint-escalate-crtc',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
