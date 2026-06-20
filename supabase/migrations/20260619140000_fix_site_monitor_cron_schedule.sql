-- ARRÊT SPAM — agent-site-monitor + agent-supervisor
-- Cause: cron */10 * * * * avec ancien code sans dedup
-- Action: désactiver agent-site-monitor, ralentir agent-supervisor (6h)

DO $$
DECLARE
  v_supervisor_cmd text;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-site-monitor') THEN
    PERFORM cron.unschedule('agent-site-monitor');
    RAISE NOTICE 'agent-site-monitor cron DÉSACTIVÉ';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-supervisor') THEN
    SELECT command INTO v_supervisor_cmd FROM cron.job WHERE jobname = 'agent-supervisor';
    PERFORM cron.unschedule('agent-supervisor');
    PERFORM cron.schedule('agent-supervisor', '0 */6 * * *', v_supervisor_cmd);
    RAISE NOTICE 'agent-supervisor ralenti à 0 */6 * * * (était */15)';
  END IF;
END;
$$;
