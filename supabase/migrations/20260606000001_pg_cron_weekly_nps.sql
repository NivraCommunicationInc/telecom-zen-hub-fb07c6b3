-- ============================================================
-- P1.1 — pg_cron triggers: weekly-sales-report + nps-survey-batch
-- ============================================================
-- Requires pg_cron and pg_net to be enabled in the Supabase project.
-- Extensions are enabled via Supabase dashboard → Extensions.
-- This migration safely unschedules any existing jobs before re-creating them.

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Remove existing jobs (safe if they don't exist) ─────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-sales-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('nps-survey-batch');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── weekly-sales-report ─────────────────────────────────────────────────────
-- Every Monday at 13:00 UTC (08:00 EST / 09:00 EDT)
-- No auth check in the function — callable with anon key
SELECT cron.schedule(
  'weekly-sales-report',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/weekly-sales-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ─── nps-survey-batch ────────────────────────────────────────────────────────
-- Every day at 14:00 UTC (09:00 EST / 10:00 EDT)
-- Sends NPS survey to clients whose subscription reached ~30 days
-- Function uses its own service-role key internally
SELECT cron.schedule(
  'nps-survey-batch',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/nps-survey-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
