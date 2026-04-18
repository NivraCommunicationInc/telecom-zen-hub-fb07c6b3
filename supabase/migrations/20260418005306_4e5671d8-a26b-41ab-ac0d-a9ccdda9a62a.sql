-- P0 GAP #8 — Cron schedule for daily admin digest at 8h AM Quebec time
-- Quebec is UTC-5 (EST) / UTC-4 (EDT). 8h AM EST = 13h UTC, 8h AM EDT = 12h UTC.
-- We use 12h UTC as the default (covers EDT which is 8 months/year).
DO $$
DECLARE
  v_existing INT;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM cron.job WHERE jobname = 'billing-admin-daily-digest-8am';
  IF v_existing > 0 THEN
    PERFORM cron.unschedule('billing-admin-daily-digest-8am');
  END IF;
END $$;

SELECT cron.schedule(
  'billing-admin-daily-digest-8am',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-admin-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron_daily_8am')
  );
  $$
);