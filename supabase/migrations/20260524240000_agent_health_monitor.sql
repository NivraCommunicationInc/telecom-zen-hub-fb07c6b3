-- ==============================================================================
-- AGENT HEALTH MONITOR (Phase E)
-- ==============================================================================
-- Pure-SQL background watcher. Runs every 30 minutes via pg_cron. Detects:
--   1. Any agent in agent_registry with consecutive_failures >= 3
--   2. Any net._http_response in the last 30 minutes with status code
--      401 / 500 / 502 / 503 / 504 (catches silent vault-key rotation
--      breakage and edge-function 5xx)
--
-- When either signal trips, an email alert is enqueued for
-- support@nivra-telecom.ca (transactional template, so the BCC oversight
-- is still applied — but the recipient is already support, so no noise
-- escalation). A 4-hour dedupe window prevents the alert from firing
-- every 30 minutes while an incident is open.
--
-- No edge function deploy required — everything runs as a SECURITY DEFINER
-- SQL function called directly by pg_cron.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_agent_health_monitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_failing_agents       jsonb;
  v_failing_count        int  := 0;
  v_bad_responses        int  := 0;
  v_recent_401           int  := 0;
  v_recent_5xx           int  := 0;
  v_last_alert           timestamptz;
  v_summary              jsonb;
  v_should_alert         boolean := false;
  v_subject              text;
  v_html                 text;
BEGIN
  -- 1) Agents with 3+ consecutive failures
  SELECT
    jsonb_agg(jsonb_build_object(
      'agent',                agent_name,
      'consecutive_failures', consecutive_failures,
      'last_error_at',        last_error_at,
      'last_error_message',   COALESCE(last_error_message, ''),
      'last_run_at',          last_run_at
    )),
    count(*)
  INTO v_failing_agents, v_failing_count
  FROM public.agent_registry
  WHERE consecutive_failures >= 3;

  -- 2) Recent bad HTTP responses (separate counts for 401 vs 5xx so the
  --    alert body distinguishes "auth broken" from "code crashed")
  SELECT
    count(*) FILTER (WHERE status_code = 401),
    count(*) FILTER (WHERE status_code BETWEEN 500 AND 504),
    count(*) FILTER (WHERE status_code IN (401, 500, 502, 503, 504))
  INTO v_recent_401, v_recent_5xx, v_bad_responses
  FROM net._http_response
  WHERE created > now() - interval '30 minutes';

  -- 3) 4-hour dedupe — do not re-alert if we already raised one
  SELECT max(created_at)
  INTO v_last_alert
  FROM public.security_events
  WHERE event_type = 'AGENT_HEALTH_ALERT'
    AND created_at > now() - interval '4 hours';

  v_should_alert :=
       (v_failing_count > 0 OR v_bad_responses > 3)
   AND v_last_alert IS NULL;

  -- Always log a low-severity heartbeat so the operator can confirm the
  -- monitor itself is alive (one row per run, ~48 rows/day, trivial)
  INSERT INTO public.security_events (event_type, severity, details)
  VALUES (
    'AGENT_HEALTH_HEARTBEAT',
    'info',
    jsonb_build_object(
      'failing_agents_count', v_failing_count,
      'recent_401_30m',       v_recent_401,
      'recent_5xx_30m',       v_recent_5xx,
      'alert_raised_this_run', v_should_alert
    )
  );

  IF NOT v_should_alert THEN
    RETURN;
  END IF;

  v_summary := jsonb_build_object(
    'failing_agents',         COALESCE(v_failing_agents, '[]'::jsonb),
    'recent_401_30m',         v_recent_401,
    'recent_5xx_30m',         v_recent_5xx,
    'bad_http_responses_30m', v_bad_responses,
    'first_detected_at',      now()
  );

  INSERT INTO public.security_events (event_type, severity, details)
  VALUES ('AGENT_HEALTH_ALERT', 'critical', v_summary);

  v_subject := format(
    '🚨 Nivra — Agents en échec (%s agents en échec, %s erreurs HTTP)',
    v_failing_count,
    v_bad_responses
  );

  v_html := concat(
    '<h2 style="font-family:sans-serif;color:#7c3aed;">Alerte de santé des agents</h2>',
    '<p style="font-family:sans-serif;font-size:14px;color:#374151;">',
    'Le moniteur a détecté un problème dans la dernière demi-heure. ',
    'Symptômes typiques de cette alerte:</p>',
    '<ul style="font-family:sans-serif;font-size:14px;color:#374151;">',
    CASE WHEN v_recent_401 > 0 THEN
      '<li><strong>HTTP 401</strong> — la clé service-role en vault a probablement été rotée. Re-jouer <code>vault-refresh-service-key</code>.</li>'
      ELSE '' END,
    CASE WHEN v_recent_5xx > 0 THEN
      '<li><strong>HTTP 5xx</strong> — une fonction Edge crash. Vérifier les logs Supabase.</li>'
      ELSE '' END,
    CASE WHEN v_failing_count > 0 THEN
      '<li><strong>'
      || v_failing_count::text
      || ' agent(s) avec 3+ échecs consécutifs</strong>. Détails dans agent_registry.last_error_message.</li>'
      ELSE '' END,
    '</ul>',
    '<p style="font-family:sans-serif;font-size:13px;color:#374151;">Détails JSON:</p>',
    '<pre style="font-family:monospace;font-size:11px;background:#f3f4f6;padding:12px;border-radius:6px;overflow-x:auto;">',
    replace(replace(v_summary::text, '<', '&lt;'), '>', '&gt;'),
    '</pre>',
    '<p style="font-family:sans-serif;font-size:13px;color:#374151;">',
    'Cette alerte se déclenche au plus une fois par 4h pendant qu''un incident est ouvert.</p>'
  );

  INSERT INTO public.email_queue (
    event_key,
    to_email,
    template_key,
    subject,
    template_vars,
    status,
    priority
  )
  VALUES (
    'agent_health_alert_' || extract(epoch from now())::bigint,
    'support@nivra-telecom.ca',
    'custom_html',
    v_subject,
    jsonb_build_object('subject', v_subject, 'html', v_html),
    'queued',
    'high'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_agent_health_monitor() IS
  'Phase E health watcher. Runs every 30 min via pg_cron. Alerts support@nivra-telecom.ca when an agent has 3+ consecutive failures or when net._http_response shows recent 401/5xx. 4h dedupe window.';

-- Schedule
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing — health monitor not scheduled.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-health-monitor-30m') THEN
    PERFORM cron.unschedule('agent-health-monitor-30m');
  END IF;

  PERFORM cron.schedule(
    'agent-health-monitor-30m',
    '*/30 * * * *',
    $job$ SELECT public.fn_agent_health_monitor(); $job$
  );

  -- One immediate fire so the first heartbeat row appears right after apply
  PERFORM public.fn_agent_health_monitor();
END $$;

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'AGENT_HEALTH_MONITOR_ACTIVATED',
  'info',
  jsonb_build_object(
    'job',     'agent-health-monitor-30m',
    'cron',    '*/30 * * * *',
    'function', 'public.fn_agent_health_monitor()',
    'recipient', 'support@nivra-telecom.ca',
    'dedupe_window', '4 hours',
    'note', 'Watches agent_registry.consecutive_failures and net._http_response 401/5xx. Logs heartbeat every run; emails alert only when a real problem is detected.'
  )
);
