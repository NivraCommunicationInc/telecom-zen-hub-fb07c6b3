SELECT cron.unschedule('agent-checkup-daily');

SELECT cron.schedule(
  'agent-checkup-weekly',
  '0 7 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/agent-checkup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);

UPDATE public.agent_registry SET
  cron_schedule = '0 7 * * 1',
  cron_job_name = 'agent-checkup-weekly',
  description = 'Rapport hebdomadaire tous les lundis 7h — tous les clients actifs avec toutes leurs informations'
WHERE agent_name = 'checkup';