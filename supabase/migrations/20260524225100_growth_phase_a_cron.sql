-- ==============================================================================
-- GROWTH PHASE A — pg_cron schedules for marketing agents
-- ==============================================================================
-- Previously the agent_registry held cron_schedule TEXT for these jobs but no
-- real pg_cron entry ever fired them — so the 203 valid CRM contacts received
-- zero emails since import. This migration creates the actual scheduled jobs.
--
-- Auth: each cron call sends the service-role key from vault, which matches
-- the SUPABASE_SERVICE_ROLE_KEY env var used by requireServiceAuth() in the
-- agent functions. Anonymous POSTs remain blocked (401).
--
-- Times are UTC. Quebec is UTC-5 (EST) / UTC-4 (EDT).
--   10h UTC = 06h EDT / 05h EST → crm-email-blast (early morning send)
--   14h UTC = 10h EDT / 09h EST → followup (mid-morning)
-- ==============================================================================

DO $$
DECLARE
  v_url      text;
  v_auth     text;
  v_secret   text;
BEGIN
  -- Confirm pg_cron + pg_net are installed before scheduling
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping schedule. Run growth_phase_a_cron later.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed — skipping schedule.';
    RETURN;
  END IF;

  -- Pull service-role token from vault (existing convention — see billing-admin-daily-digest-8am)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'vault.decrypted_secrets has no service_role_key — schedules not created. Add it via Supabase dashboard.';
    RETURN;
  END IF;

  v_url  := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1';
  v_auth := 'Bearer ' || v_secret;

  -- Idempotent: drop any prior schedules with our jobnames first
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-10utc') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-10utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-14utc') THEN
    PERFORM cron.unschedule('agent-followup-14utc');
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- Job 1: agent-crm-email-blast — daily 10h UTC
  -- Cold-touch up to 50 new prospects with consented emails.
  -- ──────────────────────────────────────────────────────────────────
  PERFORM cron.schedule(
    'agent-crm-email-blast-10utc',
    '0 10 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_daily_10utc')
      );
      $job$,
      v_url || '/agent-crm-email-blast',
      v_auth
    )
  );

  -- ──────────────────────────────────────────────────────────────────
  -- Job 2: agent-followup — daily 14h UTC
  -- Re-engage up to 30 interested / callback / no-answer leads after 14d.
  -- ──────────────────────────────────────────────────────────────────
  PERFORM cron.schedule(
    'agent-followup-14utc',
    '0 14 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_daily_14utc')
      );
      $job$,
      v_url || '/agent-followup',
      v_auth
    )
  );
END $$;

-- Sync agent_registry.cron_job_name to reality so the admin UI shows the right
-- job binding instead of a stale string.
UPDATE public.agent_registry
   SET cron_job_name = 'agent-crm-email-blast-10utc'
 WHERE agent_name = 'crm-email-blast';

UPDATE public.agent_registry
   SET cron_job_name = 'agent-followup-14utc'
 WHERE agent_name = 'followup';

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'GROWTH_PHASE_A_CRON_ACTIVATED',
  'info',
  jsonb_build_object(
    'jobs', ARRAY['agent-crm-email-blast-10utc', 'agent-followup-14utc'],
    'note', 'Marketing agents now actually scheduled — previously only metadata existed in agent_registry.cron_schedule.',
    'first_run_window_utc', '10:00 and 14:00 daily'
  )
);
