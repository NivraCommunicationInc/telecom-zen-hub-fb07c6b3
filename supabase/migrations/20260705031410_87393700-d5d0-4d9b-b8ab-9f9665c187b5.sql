
CREATE TABLE IF NOT EXISTS public.cron_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  duration_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_heartbeats_name_started ON public.cron_heartbeats(cron_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_heartbeats_status ON public.cron_heartbeats(status, started_at DESC);

GRANT SELECT ON public.cron_heartbeats TO authenticated;
GRANT ALL ON public.cron_heartbeats TO service_role;

ALTER TABLE public.cron_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cron heartbeats"
  ON public.cron_heartbeats FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'ops'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
  );

CREATE POLICY "Service role writes cron heartbeats"
  ON public.cron_heartbeats FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_cron_heartbeat(
  _cron_name TEXT,
  _status TEXT DEFAULT 'success',
  _started_at TIMESTAMPTZ DEFAULT NULL,
  _details JSONB DEFAULT '{}'::jsonb,
  _error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _start TIMESTAMPTZ := COALESCE(_started_at, now());
  _finish TIMESTAMPTZ := CASE WHEN _status IN ('success','error') THEN now() ELSE NULL END;
  _dur INTEGER := CASE WHEN _finish IS NOT NULL THEN (EXTRACT(EPOCH FROM (_finish - _start)) * 1000)::INTEGER ELSE NULL END;
BEGIN
  BEGIN
    INSERT INTO public.cron_heartbeats(cron_name, started_at, finished_at, status, duration_ms, details, error_message)
    VALUES (_cron_name, _start, _finish, _status, _dur, COALESCE(_details, '{}'::jsonb), _error_message)
    RETURNING id INTO _id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_cron_heartbeat failed: %', SQLERRM;
  END;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cron_heartbeat(TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT) TO service_role, authenticated;

CREATE OR REPLACE VIEW public.cron_health_summary
WITH (security_invoker=on)
AS
SELECT DISTINCT ON (cron_name)
  cron_name,
  started_at AS last_started_at,
  finished_at AS last_finished_at,
  status AS last_status,
  duration_ms AS last_duration_ms,
  error_message AS last_error,
  EXTRACT(EPOCH FROM (now() - COALESCE(finished_at, started_at)))::INTEGER AS seconds_since_last,
  CASE
    WHEN status = 'error' THEN 'error'
    WHEN COALESCE(finished_at, started_at) < now() - INTERVAL '24 hours' THEN 'stale'
    WHEN COALESCE(finished_at, started_at) < now() - INTERVAL '2 hours' THEN 'warning'
    ELSE 'ok'
  END AS health
FROM public.cron_heartbeats
WHERE status IN ('success','error')
ORDER BY cron_name, started_at DESC;

GRANT SELECT ON public.cron_health_summary TO authenticated, service_role;

DO $$ BEGIN PERFORM cron.unschedule('ops-watchdog-morning'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('ops-watchdog-evening'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'ops-watchdog-morning',
  '0 11 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/ops-watchdog',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{"trigger":"cron_morning"}'::jsonb
  ) AS request_id;$$
);

SELECT cron.schedule(
  'ops-watchdog-evening',
  '0 23 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/ops-watchdog',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{"trigger":"cron_evening"}'::jsonb
  ) AS request_id;$$
);
