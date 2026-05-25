-- ==============================================================================
-- GROWTH PHASE B — Multi-touch nurture sequence agent
-- ==============================================================================
-- Adds agent-crm-sequence (Phase B) which multiplies touchpoints per contact:
--
--   Step 1 (Day  0): crm_promo_blast       sent by agent-crm-email-blast
--   Step 2 (Day  3): crm_sequence_social   sent by THIS agent
--   Step 3 (Day  7): crm_sequence_savings  sent by THIS agent
--   Step 4 (Day 14): crm_sequence_lastcall sent by THIS agent
--
-- Because each step uses a DIFFERENT template_key, the 7-day dedupe baked
-- into the existing agents is naturally satisfied — every send is a new
-- payload, not a re-blast of the same message.
--
-- Effect on 219-contact cohort:
--   Phase A alone:  ~ 50/day × 5 days = ~250 sends total, then idle until D+7
--   Phase A + B  : ~ 4 touches × 219 contacts = ~876 sends over 14 days
--   (every touch carries the one-click HMAC unsubscribe URL — full CASL).
-- ==============================================================================

-- Register the new agent so dashboards see it
INSERT INTO public.agent_registry (
  agent_name, display_name, description, function_name,
  cron_schedule, cron_job_name
)
VALUES (
  'crm-sequence',
  'CRM Sequence (Multi-Touch)',
  'Sends touches 2-4 of the 4-step CASL-compliant nurture sequence (social proof, savings calc, last call).',
  'agent-crm-sequence',
  '15 */4 * * *',
  'agent-crm-sequence-4h'
)
ON CONFLICT (agent_name) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  description   = EXCLUDED.description,
  function_name = EXCLUDED.function_name,
  cron_schedule = EXCLUDED.cron_schedule,
  cron_job_name = EXCLUDED.cron_job_name,
  updated_at    = now();

-- Schedule + fire-now
DO $$
DECLARE
  v_url    text := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1';
  v_secret text;
  v_auth   text;
  v_req_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing — skipping.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net missing — skipping.';
    RETURN;
  END IF;

  -- Same fallback as Phase A: prefer 'service_role_key', else
  -- 'email_queue_service_role_key' (existing working name in this project)
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name IN ('service_role_key', 'email_queue_service_role_key')
   ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'No service-role secret in vault — sequence agent will not be scheduled.';
    RETURN;
  END IF;
  v_auth := 'Bearer ' || v_secret;

  -- Idempotent
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-sequence-4h') THEN
    PERFORM cron.unschedule('agent-crm-sequence-4h');
  END IF;

  -- Every 4 hours, offset by 15 minutes to avoid colliding with the blast
  -- (which runs at :00 of even hours) and the followup (which runs at :30).
  PERFORM cron.schedule(
    'agent-crm-sequence-4h',
    '15 */4 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_4h')
      );
      $job$,
      v_url || '/agent-crm-sequence',
      v_auth
    )
  );

  -- Fire NOW so the operator sees the first sequence batch immediately
  SELECT net.http_post(
    url     := v_url || '/agent-crm-sequence',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_auth),
    body    := jsonb_build_object('source', 'migration_fire_now')
  ) INTO v_req_id;

  INSERT INTO public.security_events (event_type, severity, details)
  VALUES (
    'GROWTH_PHASE_B_SEQUENCE_ACTIVATED',
    'info',
    jsonb_build_object(
      'job', 'agent-crm-sequence-4h (15 */4 * * *)',
      'fire_now_request_id', v_req_id,
      'templates_added', ARRAY['crm_sequence_social','crm_sequence_savings','crm_sequence_lastcall'],
      'note', 'Touches 2-4 of the multi-step nurture sequence are now live. Step 1 is still produced by agent-crm-email-blast.'
    )
  );
END $$;

-- Extend the health view to include the new agent
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
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '1 hour') AS sends_last_hour,
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '24 hours') AS sends_last_24h,
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '7 days') AS sends_last_7d
FROM public.agent_registry ar
WHERE ar.agent_name IN ('crm-email-blast', 'followup', 'retention', 'crm-sequence');
