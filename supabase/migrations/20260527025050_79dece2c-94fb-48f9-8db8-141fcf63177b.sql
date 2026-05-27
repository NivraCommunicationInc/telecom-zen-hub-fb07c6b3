CREATE OR REPLACE FUNCTION public.is_portal_projection_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.has_role(_user_id, 'admin'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'support'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'supervisor'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'billing_admin'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'techops'::public.app_role), false)
$$;

CREATE TABLE IF NOT EXISTS public.customer_portal_projection_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  audit_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'open',
  core_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  portal_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT, UPDATE ON public.customer_portal_projection_audit_logs TO authenticated;
GRANT ALL ON public.customer_portal_projection_audit_logs TO service_role;
ALTER TABLE public.customer_portal_projection_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage customer portal projection audit logs" ON public.customer_portal_projection_audit_logs;
CREATE POLICY "Staff manage customer portal projection audit logs"
ON public.customer_portal_projection_audit_logs
FOR ALL
TO authenticated
USING (public.is_portal_projection_staff(auth.uid()))
WITH CHECK (public.is_portal_projection_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.customer_portal_repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.customer_portal_repair_jobs TO authenticated;
GRANT ALL ON public.customer_portal_repair_jobs TO service_role;
ALTER TABLE public.customer_portal_repair_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage customer portal repair jobs" ON public.customer_portal_repair_jobs;
CREATE POLICY "Staff manage customer portal repair jobs"
ON public.customer_portal_repair_jobs
FOR ALL
TO authenticated
USING (public.is_portal_projection_staff(auth.uid()))
WITH CHECK (public.is_portal_projection_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_customer_portal_repair_jobs_status_schedule ON public.customer_portal_repair_jobs(status, scheduled_at, attempts);
CREATE INDEX IF NOT EXISTS idx_customer_portal_repair_jobs_user_status ON public.customer_portal_repair_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_audit_logs_status ON public.customer_portal_projection_audit_logs(status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_audit_logs_user ON public.customer_portal_projection_audit_logs(user_id, detected_at DESC);

CREATE OR REPLACE FUNCTION public.customer_portal_enqueue_repair_job(_user_id uuid, _reason text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_job_id
  FROM public.customer_portal_repair_jobs
  WHERE user_id = _user_id
    AND status IN ('pending', 'running')
    AND reason = _reason
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    UPDATE public.customer_portal_repair_jobs
    SET details = coalesce(details, '{}'::jsonb) || coalesce(_details, '{}'::jsonb),
        scheduled_at = least(scheduled_at, now()),
        updated_at = now()
    WHERE id = v_job_id;
    RETURN v_job_id;
  END IF;

  INSERT INTO public.customer_portal_repair_jobs (user_id, reason, details, status)
  VALUES (_user_id, _reason, coalesce(_details, '{}'::jsonb), 'pending')
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_record_projection_audit(
  _user_id uuid,
  _audit_type text,
  _severity text,
  _core_counts jsonb,
  _portal_counts jsonb,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.customer_portal_projection_audit_logs (user_id, audit_type, severity, core_counts, portal_counts, details, status)
  VALUES (_user_id, _audit_type, coalesce(_severity, 'warning'), coalesce(_core_counts, '{}'::jsonb), coalesce(_portal_counts, '{}'::jsonb), coalesce(_details, '{}'::jsonb), 'open')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_customer_portal_projection_divergences(_limit integer DEFAULT 2000)
RETURNS TABLE(user_id uuid, divergence_type text, severity text, details jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT p.user_id FROM public.profiles p WHERE p.user_id IS NOT NULL
    UNION SELECT a.client_id FROM public.accounts a WHERE a.client_id IS NOT NULL
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.user_id IS NOT NULL
    UNION SELECT o.user_id FROM public.orders o WHERE o.user_id IS NOT NULL
    UNION SELECT mi.client_id FROM public.monthly_invoices mi WHERE mi.client_id IS NOT NULL
    UNION SELECT p.user_id FROM public.payments p WHERE p.user_id IS NOT NULL
    UNION SELECT p.client_id FROM public.payments p WHERE p.client_id IS NOT NULL
    UNION SELECT st.user_id FROM public.support_tickets st WHERE st.user_id IS NOT NULL
    UNION SELECT st.owner_user_id FROM public.support_tickets st WHERE st.owner_user_id IS NOT NULL
    UNION SELECT ap.client_id FROM public.appointments ap WHERE ap.client_id IS NOT NULL
    UNION SELECT au.user_id FROM public.authorized_users au WHERE au.user_id IS NOT NULL
  ), limited AS (
    SELECT c.user_id FROM candidates c WHERE c.user_id IS NOT NULL LIMIT greatest(1, least(coalesce(_limit, 2000), 10000))
  ), assessed AS (
    SELECT l.user_id,
           s.last_refreshed_at,
           s.validation_status,
           s.portal_empty,
           s.core_has_data,
           s.section_counts,
           s.validation_errors,
           public.validate_customer_portal_snapshot(l.user_id, coalesce(s.snapshot, public.get_client_history_snapshot(l.user_id))) AS validation
    FROM limited l
    LEFT JOIN public.customer_portal_snapshots s ON s.user_id = l.user_id
  )
  SELECT a.user_id,
         CASE
           WHEN a.last_refreshed_at IS NULL THEN 'missing_projection'
           WHEN coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true THEN 'portal_empty_but_core_populated'
           WHEN coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'projection_validation_failed'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) THEN 'stale_snapshot'
           ELSE 'healthy'
         END AS divergence_type,
         CASE
           WHEN a.last_refreshed_at IS NULL OR (coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true) OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'critical'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' THEN 'warning'
           ELSE 'info'
         END AS severity,
         jsonb_build_object(
           'lastRefreshedAt', a.last_refreshed_at,
           'sectionCounts', coalesce(a.section_counts, '{}'::jsonb),
           'validation', a.validation,
           'validationErrors', coalesce(a.validation_errors, '[]'::jsonb)
         ) AS details
  FROM assessed a
  WHERE a.last_refreshed_at IS NULL
     OR (coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true)
     OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid'
     OR (a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_run_repair_jobs(_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_job record;
  v_processed integer := 0;
  v_repaired integer := 0;
  v_failed integer := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_portal_projection_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  FOR v_job IN
    SELECT * FROM public.customer_portal_repair_jobs
    WHERE status IN ('pending', 'failed')
      AND attempts < max_attempts
      AND scheduled_at <= now()
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT greatest(1, least(coalesce(_limit, 200), 1000))
  LOOP
    v_processed := v_processed + 1;
    BEGIN
      UPDATE public.customer_portal_repair_jobs
      SET status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now()
      WHERE id = v_job.id;

      PERFORM public.refresh_customer_portal_snapshot_internal(v_job.user_id, 'repair_job:' || v_job.reason, v_job.id);

      UPDATE public.customer_portal_repair_jobs
      SET status = 'completed', completed_at = now(), updated_at = now(), last_error = NULL
      WHERE id = v_job.id;

      UPDATE public.customer_portal_projection_audit_logs
      SET status = 'resolved', resolved_at = now()
      WHERE user_id = v_job.user_id AND status = 'open';

      v_repaired := v_repaired + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_failures := v_failures || jsonb_build_array(jsonb_build_object('job_id', v_job.id, 'user_id', v_job.user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));

      UPDATE public.customer_portal_repair_jobs
      SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'exhausted' ELSE 'failed' END,
          last_error = SQLERRM,
          scheduled_at = now() + interval '1 minute',
          updated_at = now()
      WHERE id = v_job.id;

      INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
      VALUES (v_job.user_id, 'projection_repair_failed', 'critical', 'La réparation automatique du snapshot portail a échoué.', jsonb_build_object('job_id', v_job.id, 'reason', v_job.reason, 'error', SQLERRM, 'sqlstate', SQLSTATE));
    END;
  END LOOP;

  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('repair_jobs', CASE WHEN v_failed = 0 THEN 'success' ELSE 'warning' END, 'Réparations automatiques du portail client exécutées', jsonb_build_object('processed', v_processed, 'repaired', v_repaired, 'failed', v_failed, 'failures', v_failures));

  RETURN jsonb_build_object('processed', v_processed, 'repaired', v_repaired, 'failed', v_failed, 'failures', v_failures);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_global_validation(_limit integer DEFAULT 500, _repair boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row record;
  v_checked integer := 0;
  v_repaired integer := 0;
  v_failed jsonb := '[]'::jsonb;
  v_divergences jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_sync jsonb;
  v_job_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_portal_projection_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  PERFORM public.process_customer_portal_projection_events(greatest(1, least(coalesce(_limit, 500), 2000)));

  FOR v_row IN SELECT * FROM public.detect_customer_portal_projection_divergences(greatest(1, least(coalesce(_limit, 500), 10000))) LOOP
    v_checked := v_checked + 1;
    v_divergences := v_divergences || jsonb_build_array(jsonb_build_object('user_id', v_row.user_id, 'type', v_row.divergence_type, 'severity', v_row.severity, 'details', v_row.details));

    v_validation := coalesce(v_row.details->'validation', '{}'::jsonb);
    PERFORM public.customer_portal_record_projection_audit(
      v_row.user_id,
      v_row.divergence_type,
      v_row.severity,
      coalesce(v_validation->'coreCounts', '{}'::jsonb),
      coalesce(v_validation->'sectionCounts', v_row.details->'sectionCounts', '{}'::jsonb),
      v_row.details
    );

    SELECT public.customer_portal_enqueue_repair_job(v_row.user_id, v_row.divergence_type, v_row.details) INTO v_job_id;

    IF _repair THEN
      BEGIN
        PERFORM public.refresh_customer_portal_snapshot_internal(v_row.user_id, 'global_validation_repair', v_job_id);
        UPDATE public.customer_portal_repair_jobs
        SET status = 'completed', attempts = attempts + 1, started_at = coalesce(started_at, now()), completed_at = now(), updated_at = now(), last_error = NULL
        WHERE id = v_job_id;
        UPDATE public.customer_portal_projection_audit_logs
        SET status = 'resolved', resolved_at = now()
        WHERE user_id = v_row.user_id AND status = 'open';
        v_repaired := v_repaired + 1;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed || jsonb_build_array(jsonb_build_object('user_id', v_row.user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
        UPDATE public.customer_portal_repair_jobs
        SET status = 'failed', attempts = attempts + 1, last_error = SQLERRM, scheduled_at = now() + interval '1 minute', updated_at = now()
        WHERE id = v_job_id;
        INSERT INTO public.customer_portal_projection_logs (user_id, event_source, status, message, details)
        VALUES (v_row.user_id, 'global_validation', 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE, 'divergence', v_row.divergence_type));
        INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
        VALUES (v_row.user_id, 'projection_repair_failed', 'critical', 'La réparation automatique du snapshot portail a échoué.', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'divergence', v_row.divergence_type));
      END;
    END IF;
  END LOOP;

  IF _repair THEN
    PERFORM public.customer_portal_run_repair_jobs(greatest(1, least(coalesce(_limit, 500), 1000)));
  END IF;

  v_sync := public.customer_portal_realtime_sync_verifier(5);
  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('global_validation', CASE WHEN jsonb_array_length(v_failed) = 0 THEN 'success' ELSE 'warning' END, 'Validation globale du portail client exécutée', jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed, 'divergences', v_divergences, 'realtime', v_sync));

  RETURN jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed, 'divergences', v_divergences, 'realtime', v_sync);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_snapshots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_snapshots;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_alerts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_repair_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_repair_jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_audit_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_audit_logs;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_portal_projection_staff(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_portal_projection_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_projection_staff(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_enqueue_repair_job(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_enqueue_repair_job(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_enqueue_repair_job(uuid, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_record_projection_audit(uuid, text, text, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_record_projection_audit(uuid, text, text, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_record_projection_audit(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_run_repair_jobs(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_run_repair_jobs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_run_repair_jobs(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO service_role;