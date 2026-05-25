-- 1. Recréer le trigger heartbeat manquant sur agent_audit_log
DROP TRIGGER IF EXISTS trg_agent_audit_heartbeat ON public.agent_audit_log;
CREATE TRIGGER trg_agent_audit_heartbeat
AFTER INSERT ON public.agent_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.fn_agent_audit_heartbeat();

-- 2. Backfill agent_registry depuis l'historique existant pour les agents impactés
INSERT INTO public.agent_registry (agent_name, display_name, function_name, status, last_run_at, last_success_at, total_runs, total_successes, total_failures, consecutive_failures, health_score, updated_at)
SELECT
  a.agent_name,
  a.agent_name,
  a.agent_name,
  'active',
  max(a.created_at),
  max(a.created_at) FILTER (WHERE COALESCE(LOWER(a.result),'') NOT IN ('failure','error','failed')),
  count(*),
  count(*) FILTER (WHERE COALESCE(LOWER(a.result),'') NOT IN ('failure','error','failed')),
  count(*) FILTER (WHERE COALESCE(LOWER(a.result),'') IN ('failure','error','failed')),
  0, 100, now()
FROM public.agent_audit_log a
WHERE a.agent_name IN ('crm-email-blast','followup')
GROUP BY a.agent_name
ON CONFLICT (agent_name) DO UPDATE SET
  last_run_at = EXCLUDED.last_run_at,
  last_success_at = EXCLUDED.last_success_at,
  total_runs = EXCLUDED.total_runs,
  total_successes = EXCLUDED.total_successes,
  total_failures = EXCLUDED.total_failures,
  updated_at = now();

-- 3. Reprogrammer les cron jobs en utilisant la clé du coffre-fort existante
DO $$
DECLARE
  v_url    text := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1';
  v_secret text;
  v_auth   text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'vault secret email_queue_service_role_key missing';
  END IF;

  v_auth := 'Bearer ' || v_secret;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='agent-crm-email-blast-daily') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='agent-followup-daily') THEN
    PERFORM cron.unschedule('agent-followup-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='agent-crm-email-blast-2h') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-2h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='agent-followup-3h') THEN
    PERFORM cron.unschedule('agent-followup-3h');
  END IF;

  PERFORM cron.schedule(
    'agent-crm-email-blast-2h', '0 */2 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L),
        body := jsonb_build_object('source','cron_2h')
      );
    $job$, v_url || '/agent-crm-email-blast', v_auth)
  );

  PERFORM cron.schedule(
    'agent-followup-3h', '30 */3 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L),
        body := jsonb_build_object('source','cron_3h')
      );
    $job$, v_url || '/agent-followup', v_auth)
  );

  -- Fire both agents NOW
  PERFORM net.http_post(
    url := v_url || '/agent-crm-email-blast',
    headers := jsonb_build_object('Content-Type','application/json','Authorization', v_auth),
    body := jsonb_build_object('source','manual_fire_now')
  );
  PERFORM net.http_post(
    url := v_url || '/agent-followup',
    headers := jsonb_build_object('Content-Type','application/json','Authorization', v_auth),
    body := jsonb_build_object('source','manual_fire_now')
  );

  -- Met à jour le registre avec les nouveaux noms de cron
  UPDATE public.agent_registry SET cron_job_name='agent-crm-email-blast-2h', cron_schedule='0 */2 * * *' WHERE agent_name='crm-email-blast';
  UPDATE public.agent_registry SET cron_job_name='agent-followup-3h', cron_schedule='30 */3 * * *' WHERE agent_name='followup';
END $$;