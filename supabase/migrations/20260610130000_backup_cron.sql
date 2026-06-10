-- ═══════════════════════════════════════════════════════════════════════════
-- DAILY DATA BACKUP CRON — June 10, 2026
-- ═══════════════════════════════════════════════════════════════════════════
-- Schedules daily-data-backup edge function at 02:00 UTC via pg_cron.
-- Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in app.settings.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_daily_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT := current_setting('app.settings.supabase_url', true);
  v_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    INSERT INTO public.billing_system_alerts (alert_type, entity_type, severity, details)
    VALUES ('backup_config_missing', 'daily_backup', 'high',
            '{"reason": "app.settings.supabase_url or service_role_key not configured"}');
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/daily-data-backup',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey',        v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_daily_backup() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run backup daily at 02:00 UTC
    PERFORM cron.schedule(
      'nivra-daily-backup',
      '0 2 * * *',
      $$SELECT public.trigger_daily_backup()$$
    );
  END IF;
END;
$$;
