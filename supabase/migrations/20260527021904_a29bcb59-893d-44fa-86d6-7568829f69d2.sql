CREATE OR REPLACE VIEW public.customer_unified_projection
WITH (security_invoker = on) AS
SELECT
  user_id,
  account_id,
  customer_ids,
  account_ids,
  order_ids,
  subscription_ids,
  snapshot,
  section_counts,
  core_has_data,
  portal_empty,
  validation_status,
  validation_errors,
  projection_version,
  last_event_source,
  last_event_id,
  last_refreshed_at,
  updated_at
FROM public.customer_portal_snapshots;

GRANT SELECT ON public.customer_unified_projection TO authenticated;
GRANT ALL ON public.customer_unified_projection TO service_role;

CREATE OR REPLACE FUNCTION public.customer_portal_core_has_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_auth_email text;
  v_profile public.profiles%ROWTYPE;
  v_has_profile boolean := false;
  v_related_user_ids uuid[] := ARRAY[_user_id]::uuid[];
  v_emails text[] := ARRAY[]::text[];
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT lower(btrim(u.email))
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = _user_id
    AND nullif(btrim(u.email), '') IS NOT NULL
  LIMIT 1;

  IF v_auth_email IS NOT NULL THEN
    v_emails := array_append(v_emails, v_auth_email);
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = _user_id
     OR p.id = _user_id
     OR (v_auth_email IS NOT NULL AND lower(btrim(p.email)) = v_auth_email)
  ORDER BY CASE WHEN p.user_id = _user_id THEN 0 WHEN p.id = _user_id THEN 1 ELSE 2 END,
           p.updated_at DESC NULLS LAST,
           p.created_at DESC NULLS LAST
  LIMIT 1;
  v_has_profile := FOUND;

  IF v_has_profile THEN
    SELECT array_remove(array_agg(DISTINCT user_id), NULL)
    INTO v_related_user_ids
    FROM (
      SELECT _user_id AS user_id
      UNION SELECT v_profile.id
      UNION SELECT v_profile.user_id
    ) u;
  END IF;

  SELECT array_remove(array_agg(DISTINCT email), NULL)
  INTO v_emails
  FROM (
    SELECT unnest(coalesce(v_emails, ARRAY[]::text[])) AS email
    UNION SELECT lower(btrim(v_profile.email)) WHERE v_has_profile AND nullif(btrim(v_profile.email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.pending_email)) WHERE v_has_profile AND nullif(btrim(v_profile.pending_email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.interac_email)) WHERE v_has_profile AND nullif(btrim(v_profile.interac_email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.professional_email)) WHERE v_has_profile AND nullif(btrim(v_profile.professional_email), '') IS NOT NULL
  ) e;

  SELECT array_remove(array_agg(DISTINCT bc.id), NULL)
  INTO v_customer_ids
  FROM public.billing_customers bc
  WHERE bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(bc.email)) = ANY(v_emails));

  SELECT array_remove(array_agg(DISTINCT a.id), NULL)
  INTO v_account_ids
  FROM public.accounts a
  WHERE a.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (v_has_profile AND nullif(btrim(v_profile.account_number), '') IS NOT NULL AND a.account_number = v_profile.account_number);

  SELECT array_remove(array_agg(DISTINCT o.id), NULL)
  INTO v_order_ids
  FROM public.orders o
  WHERE o.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND o.account_id = ANY(v_account_ids))
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(o.client_email)) = ANY(v_emails));

  SELECT array_remove(array_agg(DISTINCT bs.id), NULL)
  INTO v_subscription_ids
  FROM public.billing_subscriptions bs
  WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bs.customer_id = ANY(v_customer_ids))
     OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bs.order_id = ANY(v_order_ids));

  RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR p.id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[])) OR a.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.billing_customers bc WHERE bc.id = ANY(coalesce(v_customer_ids, ARRAY[]::uuid[])) OR bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = ANY(coalesce(v_order_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.billing_subscriptions bs WHERE bs.id = ANY(coalesce(v_subscription_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids)))
      OR EXISTS (SELECT 1 FROM public.monthly_invoices mi WHERE mi.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])))
      OR EXISTS (SELECT 1 FROM public.billing_payments bp WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bp.customer_id = ANY(v_customer_ids)) OR EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE bi.id = bp.invoice_id AND ((coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids)))))
      OR EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR p.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND p.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND p.order_id = ANY(v_order_ids)))
      OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR c.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND c.order_id = ANY(v_order_ids)))
      OR EXISTS (SELECT 1 FROM public.equipment_inventory ei WHERE (coalesce(array_length(v_account_ids, 1), 0) > 0 AND ei.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ei.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND ei.subscription_id = ANY(v_subscription_ids)))
      OR EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(st.client_email)) = ANY(v_emails)))
      OR EXISTS (SELECT 1 FROM public.appointments ap WHERE ap.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ap.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ap.client_email)) = ANY(v_emails)))
      OR EXISTS (SELECT 1 FROM public.service_instances si WHERE si.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND si.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND si.order_id = ANY(v_order_ids)))
      OR EXISTS (SELECT 1 FROM public.service_addresses sa WHERE coalesce(array_length(v_account_ids, 1), 0) > 0 AND sa.account_id = ANY(v_account_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_portal_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cached public.customer_portal_snapshots%ROWTYPE;
  v_is_stale boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO v_cached FROM public.customer_portal_snapshots WHERE user_id = _user_id;
  v_is_stale := NOT FOUND OR v_cached.last_refreshed_at < now() - interval '30 seconds' OR v_cached.validation_status <> 'valid' OR (v_cached.core_has_data = true AND v_cached.portal_empty = true);

  IF v_is_stale THEN
    RETURN public.refresh_customer_portal_snapshot_internal(_user_id, 'read_hydration_repair', NULL);
  END IF;

  RETURN v_cached.snapshot || jsonb_build_object('projection', jsonb_build_object('source', 'customer_portal_snapshot', 'version', v_cached.projection_version, 'lastRefreshedAt', v_cached.last_refreshed_at, 'sectionCounts', v_cached.section_counts, 'validationStatus', v_cached.validation_status, 'validationErrors', v_cached.validation_errors, 'coreHasData', v_cached.core_has_data, 'portalEmpty', v_cached.portal_empty, 'stale', false));
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_missing_customer_portal_projections()
RETURNS TABLE(user_id uuid, reason text, core_sources jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH core_users AS (
    SELECT p.user_id, 'profile' AS source FROM public.profiles p WHERE p.user_id IS NOT NULL
    UNION ALL SELECT a.client_id, 'account' FROM public.accounts a WHERE a.client_id IS NOT NULL
    UNION ALL SELECT bc.user_id, 'billing_customer' FROM public.billing_customers bc WHERE bc.user_id IS NOT NULL
    UNION ALL SELECT o.user_id, 'order' FROM public.orders o WHERE o.user_id IS NOT NULL
    UNION ALL SELECT mi.client_id, 'monthly_invoice' FROM public.monthly_invoices mi WHERE mi.client_id IS NOT NULL
    UNION ALL SELECT p.user_id, 'payment' FROM public.payments p WHERE p.user_id IS NOT NULL
    UNION ALL SELECT p.client_id, 'payment' FROM public.payments p WHERE p.client_id IS NOT NULL
    UNION ALL SELECT st.user_id, 'support_ticket' FROM public.support_tickets st WHERE st.user_id IS NOT NULL
    UNION ALL SELECT st.owner_user_id, 'support_ticket' FROM public.support_tickets st WHERE st.owner_user_id IS NOT NULL
    UNION ALL SELECT ap.client_id, 'appointment' FROM public.appointments ap WHERE ap.client_id IS NOT NULL
  ), grouped AS (
    SELECT cu.user_id, jsonb_agg(DISTINCT cu.source) AS sources
    FROM core_users cu
    WHERE cu.user_id IS NOT NULL
    GROUP BY cu.user_id
  )
  SELECT g.user_id, 'missing_projection', jsonb_build_object('sources', g.sources)
  FROM grouped g
  LEFT JOIN public.customer_portal_snapshots s ON s.user_id = g.user_id
  WHERE s.user_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.detect_customer_portal_orphan_relations()
RETURNS TABLE(orphan_type text, source_table text, source_id uuid, details jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'invoice_without_customer_or_order', 'billing_invoices', bi.id, to_jsonb(bi)
  FROM public.billing_invoices bi
  WHERE bi.customer_id IS NULL AND bi.order_id IS NULL
  UNION ALL
  SELECT 'payment_without_customer_or_invoice', 'billing_payments', bp.id, to_jsonb(bp)
  FROM public.billing_payments bp
  WHERE bp.customer_id IS NULL AND bp.invoice_id IS NULL
  UNION ALL
  SELECT 'subscription_without_customer_or_order', 'billing_subscriptions', bs.id, to_jsonb(bs)
  FROM public.billing_subscriptions bs
  WHERE bs.customer_id IS NULL AND bs.order_id IS NULL
  UNION ALL
  SELECT 'equipment_without_account_order_subscription', 'equipment_inventory', ei.id, to_jsonb(ei)
  FROM public.equipment_inventory ei
  WHERE ei.account_id IS NULL AND ei.order_id IS NULL AND ei.subscription_id IS NULL
  UNION ALL
  SELECT 'contract_without_user_or_order', 'contracts', c.id, to_jsonb(c)
  FROM public.contracts c
  WHERE c.user_id IS NULL AND c.owner_user_id IS NULL AND c.order_id IS NULL
  UNION ALL
  SELECT 'ticket_without_owner_or_email', 'support_tickets', st.id, to_jsonb(st)
  FROM public.support_tickets st
  WHERE st.user_id IS NULL AND st.owner_user_id IS NULL AND nullif(btrim(st.client_email), '') IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.repair_customer_portal_projection_batch(_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_processed integer := 0;
  v_event_count integer := 0;
  v_missing_count integer := 0;
  v_empty_count integer := 0;
  v_stale_count integer := 0;
  v_failed jsonb := '[]'::jsonb;
BEGIN
  SELECT public.process_customer_portal_projection_events(greatest(1, least(coalesce(_limit, 100), 500))) INTO v_event_count;

  FOR v_uid IN
    SELECT candidate.user_id
    FROM (
      SELECT m.user_id, 0 AS priority FROM public.detect_missing_customer_portal_projections() m
      UNION ALL
      SELECT s.user_id, 1 FROM public.customer_portal_snapshots s WHERE s.core_has_data = true AND s.portal_empty = true
      UNION ALL
      SELECT s.user_id, 2 FROM public.customer_portal_snapshots s WHERE s.validation_status <> 'valid'
      UNION ALL
      SELECT s.user_id, 3 FROM public.customer_portal_snapshots s WHERE s.last_refreshed_at < now() - interval '5 minutes' AND s.core_has_data = true
    ) candidate
    GROUP BY candidate.user_id
    ORDER BY min(candidate.priority)
    LIMIT greatest(1, least(coalesce(_limit, 100), 500))
  LOOP
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.customer_portal_snapshots s WHERE s.user_id = v_uid) THEN
        v_missing_count := v_missing_count + 1;
      ELSIF EXISTS (SELECT 1 FROM public.customer_portal_snapshots s WHERE s.user_id = v_uid AND s.core_has_data = true AND s.portal_empty = true) THEN
        v_empty_count := v_empty_count + 1;
      ELSE
        v_stale_count := v_stale_count + 1;
      END IF;

      PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, 'auto_repair_job', NULL);
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object('user_id', v_uid, 'error', SQLERRM, 'sqlstate', SQLSTATE));
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, status, message, details)
      VALUES (v_uid, 'auto_repair_job', 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    END;
  END LOOP;

  INSERT INTO public.customer_portal_projection_logs (event_source, status, section_counts, message, details)
  VALUES (
    'auto_repair_job',
    CASE WHEN jsonb_array_length(v_failed) = 0 THEN 'success' ELSE 'warning' END,
    '{}'::jsonb,
    'Réparation automatique des projections portail exécutée',
    jsonb_build_object('processed', v_processed, 'eventsProcessed', v_event_count, 'missingProjectionRepairs', v_missing_count, 'emptyPortalRepairs', v_empty_count, 'staleRepairs', v_stale_count, 'failures', v_failed)
  );

  RETURN jsonb_build_object('processed', v_processed, 'eventsProcessed', v_event_count, 'missingProjectionRepairs', v_missing_count, 'emptyPortalRepairs', v_empty_count, 'staleRepairs', v_stale_count, 'failures', v_failed);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_customer_portal_integrity_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_missing jsonb;
  v_empty jsonb;
  v_orphans jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_missing FROM public.detect_missing_customer_portal_projections() m;
  SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) INTO v_empty FROM public.detect_portal_empty_core_populated() e;
  SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) INTO v_orphans FROM public.detect_customer_portal_orphan_relations() o;

  INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
  SELECT (m->>'user_id')::uuid, 'missing_projection', 'critical', 'Client avec données Core sans projection portail.', m
  FROM jsonb_array_elements(v_missing) m
  ON CONFLICT DO NOTHING;

  INSERT INTO public.customer_portal_projection_alerts (user_id, account_id, alert_type, severity, message, details)
  SELECT (e->>'user_id')::uuid, nullif(e->>'account_id', '')::uuid, 'portal_empty_core_populated', 'critical', 'Projection portail vide alors que Core contient des données.', e
  FROM jsonb_array_elements(v_empty) e
  ON CONFLICT DO NOTHING;

  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('integrity_checker', CASE WHEN jsonb_array_length(v_missing) + jsonb_array_length(v_empty) + jsonb_array_length(v_orphans) = 0 THEN 'success' ELSE 'warning' END, 'Integrity checker portail client exécuté', jsonb_build_object('missingProjections', v_missing, 'emptyButCorePopulated', v_empty, 'orphanRelations', v_orphans));

  RETURN jsonb_build_object('missingProjections', v_missing, 'emptyButCorePopulated', v_empty, 'orphanRelations', v_orphans);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_missing_customer_portal_projections() FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_missing_customer_portal_projections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_missing_customer_portal_projections() TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_customer_portal_orphan_relations() FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_orphan_relations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_orphan_relations() TO service_role;
REVOKE EXECUTE ON FUNCTION public.repair_customer_portal_projection_batch(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.repair_customer_portal_projection_batch(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_customer_portal_projection_batch(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.run_customer_portal_integrity_check() FROM anon;
GRANT EXECUTE ON FUNCTION public.run_customer_portal_integrity_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_customer_portal_integrity_check() TO service_role;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('auto_repair_scheduler', 'warning', 'pg_cron indisponible; réparation disponible via RPC.', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END $$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'customer-portal-projection-repair') THEN
      PERFORM cron.unschedule('customer-portal-projection-repair');
    END IF;
    PERFORM cron.schedule(
      'customer-portal-projection-repair',
      '*/2 * * * *',
      $cron$SELECT public.repair_customer_portal_projection_batch(200); SELECT public.run_customer_portal_integrity_check();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('auto_repair_scheduler', 'warning', 'Planification automatique échouée; réparation disponible via RPC.', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END $$;