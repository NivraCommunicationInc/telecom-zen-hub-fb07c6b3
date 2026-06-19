-- Register the new agent
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

DO $$
DECLARE
  v_url    text := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1';
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

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-sequence-4h') THEN
    PERFORM cron.unschedule('agent-crm-sequence-4h');
  END IF;

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