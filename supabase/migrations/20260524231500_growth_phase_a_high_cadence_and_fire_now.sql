-- ==============================================================================
-- GROWTH PHASE A — High-cadence schedule + immediate one-shot fire
-- ==============================================================================
-- Replaces the daily 10h / 14h UTC schedule with a 24/7 cadence (every 2h for
-- the cold-blast, every 3h for the warm follow-up) and triggers an immediate
-- one-shot run on apply so the operator can see real send traffic right away.
--
-- IMPORTANT — Volume cap reminder
-- The 7-day per-contact dedupe in email_queue is a hard CASL guardrail.
-- Running every 2h does NOT multiply outbound volume on a fixed list of 203
-- contacts. The first pass of the day sweeps the eligible cohort; subsequent
-- passes early-return with `no_targets`. Higher cadence is for:
--   (a) reacting to newly-added leads within ~2h instead of 24h,
--   (b) recovering automatically from transient failures,
--   (c) producing visible activity in agent_events for the operator.
-- ==============================================================================

DO $$
DECLARE
  v_url     text := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1';
  v_secret  text;
  v_auth    text;
  v_blast_req_id  bigint;
  v_follow_req_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing — skipping.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net missing — skipping.';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'vault service_role_key missing — skipping.';
    RETURN;
  END IF;
  v_auth := 'Bearer ' || v_secret;

  -- ──────────────────────────────────────────────────────────────────
  -- Drop the daily-only schedules and any prior 2h schedule (idempotent).
  -- ──────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-10utc') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-10utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-14utc') THEN
    PERFORM cron.unschedule('agent-followup-14utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-2h') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-2h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-3h') THEN
    PERFORM cron.unschedule('agent-followup-3h');
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- Cold-blast: every 2h, 24/7. ~50 contacts/run capped by the agent;
  --             7-day per-contact dedupe enforced inside the agent.
  -- ──────────────────────────────────────────────────────────────────
  PERFORM cron.schedule(
    'agent-crm-email-blast-2h',
    '0 */2 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_2h')
      );
      $job$,
      v_url || '/agent-crm-email-blast',
      v_auth
    )
  );

  -- ──────────────────────────────────────────────────────────────────
  -- Warm follow-up: every 3h, 24/7. ~30 contacts/run capped by the
  --                 agent; 14-day dedupe inside the agent.
  -- ──────────────────────────────────────────────────────────────────
  PERFORM cron.schedule(
    'agent-followup-3h',
    '30 */3 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_3h')
      );
      $job$,
      v_url || '/agent-followup',
      v_auth
    )
  );

  UPDATE public.agent_registry
     SET cron_job_name = 'agent-crm-email-blast-2h',
         cron_schedule = '0 */2 * * *'
   WHERE agent_name = 'crm-email-blast';

  UPDATE public.agent_registry
     SET cron_job_name = 'agent-followup-3h',
         cron_schedule = '30 */3 * * *'
   WHERE agent_name = 'followup';

  -- ──────────────────────────────────────────────────────────────────
  -- One-shot fire NOW — operator wants visible traffic immediately.
  -- pg_net is asynchronous; the requests are queued and the agents will
  -- log into agent_events / agent_audit_log / email_queue within ~60s.
  -- ──────────────────────────────────────────────────────────────────
  SELECT net.http_post(
    url     := v_url || '/agent-crm-email-blast',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_auth),
    body    := jsonb_build_object('source', 'migration_fire_now')
  ) INTO v_blast_req_id;

  SELECT net.http_post(
    url     := v_url || '/agent-followup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_auth),
    body    := jsonb_build_object('source', 'migration_fire_now')
  ) INTO v_follow_req_id;

  INSERT INTO public.security_events (event_type, severity, details)
  VALUES (
    'GROWTH_PHASE_A_HIGH_CADENCE_ACTIVATED',
    'info',
    jsonb_build_object(
      'jobs', ARRAY['agent-crm-email-blast-2h (0 */2 * * *)', 'agent-followup-3h (30 */3 * * *)'],
      'one_shot_request_ids', jsonb_build_object(
        'blast',    v_blast_req_id,
        'followup', v_follow_req_id
      ),
      'note', 'Replaced daily schedule with 2h/3h cadence. Fired both agents once during migration.'
    )
  );
END $$;

-- ==============================================================================
-- Monitoring view — single query for the operator dashboard
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_growth_agent_health AS
SELECT
  ar.agent_name,
  ar.cron_job_name,
  ar.cron_schedule,
  ar.last_run_at,
  ar.last_success_at,
  ar.last_error_at,
  ar.last_error_message,
  ar.total_runs,
  ar.total_successes,
  ar.total_failures,
  ar.consecutive_failures,
  -- Last hour traffic
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '1 hour') AS sends_last_hour,
  -- Last 24h traffic
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '24 hours') AS sends_last_24h,
  -- Last 7d traffic
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '7 days') AS sends_last_7d
FROM public.agent_registry ar
WHERE ar.agent_name IN ('crm-email-blast', 'followup', 'retention');

COMMENT ON VIEW public.v_growth_agent_health IS
  'Single-row-per-agent health snapshot for the marketing/growth agents. Read from the admin dashboard.';
