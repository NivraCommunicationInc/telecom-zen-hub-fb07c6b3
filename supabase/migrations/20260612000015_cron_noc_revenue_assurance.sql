-- AUDIT FIX NOC-1 + RA-1: Add noc-monitor and revenue-assurance to pg_cron
-- These critical monitoring functions were DEPLOYED but never scheduled.
-- noc-monitor: every 30 minutes (matches the ALERT_ESCALATE_HOURS=6 threshold)
-- revenue-assurance: daily at 03:30 UTC (after billing-reconcile-invoices at 01:30)

-- Remove existing entries if any (idempotent)
SELECT cron.unschedule('noc-monitor') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'noc-monitor');
SELECT cron.unschedule('revenue-assurance') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-assurance');

-- noc-monitor: every 30 minutes, no auth header required (internal cron mode)
SELECT cron.schedule(
  'noc-monitor',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/noc-monitor',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- revenue-assurance: daily at 03:30 UTC (after reconcile, before business day)
SELECT cron.schedule(
  'revenue-assurance',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/revenue-assurance',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
