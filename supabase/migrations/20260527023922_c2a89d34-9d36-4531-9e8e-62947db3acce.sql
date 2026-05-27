CREATE OR REPLACE FUNCTION public.customer_portal_core_domain_presence(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_snapshot jsonb;
  v_ids jsonb;
  v_related_user_ids uuid[] := ARRAY[_user_id]::uuid[];
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  v_snapshot := public.get_client_history_snapshot(_user_id);
  v_ids := coalesce(v_snapshot->'identifiers', '{}'::jsonb);

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_related_user_ids FROM jsonb_array_elements_text(coalesce(v_ids->'relatedUserIds', jsonb_build_array(_user_id))) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_customer_ids FROM jsonb_array_elements_text(coalesce(v_ids->'customerIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_account_ids FROM jsonb_array_elements_text(coalesce(v_ids->'accountIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_order_ids FROM jsonb_array_elements_text(coalesce(v_ids->'orderIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_subscription_ids FROM jsonb_array_elements_text(coalesce(v_ids->'subscriptionIds', '[]'::jsonb)) AS value;

  RETURN jsonb_build_object(
    'profile', CASE WHEN coalesce(v_snapshot->'profile', 'null'::jsonb) <> 'null'::jsonb THEN 1 ELSE 0 END,
    'account', CASE WHEN coalesce(v_snapshot->'account', 'null'::jsonb) <> 'null'::jsonb THEN 1 ELSE 0 END,
    'services', public.customer_portal_snapshot_array_count(v_snapshot, 'subscriptions') + public.customer_portal_snapshot_array_count(v_snapshot, 'serviceInstances'),
    'orders', public.customer_portal_snapshot_array_count(v_snapshot, 'orders') + public.customer_portal_snapshot_array_count(v_snapshot, 'phoneOrders'),
    'invoices', public.customer_portal_snapshot_array_count(v_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(v_snapshot, 'monthlyInvoices'),
    'payments', public.customer_portal_snapshot_array_count(v_snapshot, 'payments') + public.customer_portal_snapshot_array_count(v_snapshot, 'legacyPayments'),
    'contracts', public.customer_portal_snapshot_array_count(v_snapshot, 'contracts'),
    'equipment', public.customer_portal_snapshot_array_count(v_snapshot, 'equipment'),
    'tickets', public.customer_portal_snapshot_array_count(v_snapshot, 'supportTickets') + public.customer_portal_snapshot_array_count(v_snapshot, 'replacementTickets'),
    'appointments', public.customer_portal_snapshot_array_count(v_snapshot, 'appointments'),
    'documents', public.customer_portal_snapshot_array_count(v_snapshot, 'autoDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'clientDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'orderDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'paymentProofs') + public.customer_portal_snapshot_array_count(v_snapshot, 'documentRequests'),
    'notifications', public.customer_portal_snapshot_array_count(v_snapshot, 'notifications'),
    'activity', public.customer_portal_snapshot_array_count(v_snapshot, 'activity'),
    'ledger', public.customer_portal_snapshot_array_count(v_snapshot, 'payments') + public.customer_portal_snapshot_array_count(v_snapshot, 'legacyPayments') + public.customer_portal_snapshot_array_count(v_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(v_snapshot, 'monthlyInvoices'),
    'identifiers', jsonb_build_object('relatedUserIds', to_jsonb(coalesce(v_related_user_ids, ARRAY[]::uuid[])), 'customerIds', to_jsonb(coalesce(v_customer_ids, ARRAY[]::uuid[])), 'accountIds', to_jsonb(coalesce(v_account_ids, ARRAY[]::uuid[])), 'orderIds', to_jsonb(coalesce(v_order_ids, ARRAY[]::uuid[])), 'subscriptionIds', to_jsonb(coalesce(v_subscription_ids, ARRAY[]::uuid[])))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_customer_portal_snapshot(_user_id uuid, _snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_counts jsonb := public.customer_portal_projection_domain_counts(coalesce(_snapshot, '{}'::jsonb));
  v_core_counts jsonb := public.customer_portal_core_domain_presence(_user_id);
  v_errors jsonb := '[]'::jsonb;
  v_core_has_data boolean := false;
  v_portal_empty boolean := public.customer_portal_snapshot_domain_empty(v_counts);
  v_domain text;
  v_core_count integer;
  v_portal_count integer;
BEGIN
  FOREACH v_domain IN ARRAY ARRAY['services','orders','invoices','payments','contracts','equipment','tickets','appointments','documents','notifications','activity','ledger'] LOOP
    v_core_count := coalesce((v_core_counts->>v_domain)::integer, 0);
    v_portal_count := coalesce((v_counts->>v_domain)::integer, 0);
    IF v_core_count > 0 THEN
      v_core_has_data := true;
      IF v_portal_count <= 0 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'CORE_DOMAIN_MISSING_IN_PORTAL', 'severity', 'critical', 'domain', v_domain, 'coreCount', v_core_count, 'portalCount', v_portal_count, 'message', 'Core contient des données pour ce domaine mais le portail ne les projette pas.'));
      END IF;
    END IF;
  END LOOP;

  IF coalesce((v_core_counts->>'account')::integer, 0) > 0 OR coalesce((v_core_counts->>'profile')::integer, 0) > 0 THEN
    v_core_has_data := true;
  END IF;

  IF v_core_has_data AND v_portal_empty THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'PORTAL_EMPTY_CORE_POPULATED', 'severity', 'critical', 'message', 'Core contient des données client mais la projection portail ne contient aucune donnée métier.', 'sectionCounts', v_counts, 'coreCounts', v_core_counts));
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'valid' ELSE 'invalid' END, 'errors', v_errors, 'sectionCounts', v_counts, 'coreCounts', v_core_counts, 'coreHasData', v_core_has_data, 'portalEmpty', v_portal_empty);
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
  ), limited AS (
    SELECT c.user_id FROM candidates c WHERE c.user_id IS NOT NULL LIMIT greatest(1, least(coalesce(_limit, 2000), 10000))
  ), assessed AS (
    SELECT l.user_id, s.last_refreshed_at, s.validation_status, s.portal_empty, s.core_has_data, s.section_counts, s.validation_errors, public.validate_customer_portal_snapshot(l.user_id, coalesce(s.snapshot, public.get_client_history_snapshot(l.user_id))) AS validation
    FROM limited l
    LEFT JOIN public.customer_portal_snapshots s ON s.user_id = l.user_id
  )
  SELECT a.user_id,
         CASE
           WHEN a.last_refreshed_at IS NULL THEN 'missing_projection'
           WHEN a.core_has_data = true AND a.portal_empty = true THEN 'portal_empty_but_core_populated'
           WHEN coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'projection_validation_failed'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) THEN 'stale_snapshot'
           ELSE 'healthy'
         END AS divergence_type,
         CASE
           WHEN a.last_refreshed_at IS NULL OR a.core_has_data = true AND a.portal_empty = true OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'critical'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' THEN 'warning'
           ELSE 'info'
         END AS severity,
         jsonb_build_object('lastRefreshedAt', a.last_refreshed_at, 'sectionCounts', a.section_counts, 'validation', a.validation, 'validationErrors', a.validation_errors) AS details
  FROM assessed a
  WHERE a.last_refreshed_at IS NULL
     OR a.core_has_data = true AND a.portal_empty = true
     OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid'
     OR a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_realtime_sync_verifier(_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pendingEvents', (SELECT count(*) FROM public.customer_portal_projection_events WHERE status IN ('pending','processing') AND created_at < now() - make_interval(mins => greatest(1, coalesce(_minutes, 5)))),
    'failedEvents', (SELECT count(*) FROM public.customer_portal_projection_events WHERE status = 'failed' AND created_at > now() - interval '24 hours'),
    'openAlerts', (SELECT count(*) FROM public.customer_portal_projection_alerts WHERE status = 'open'),
    'staleSnapshots', (SELECT count(*) FROM public.customer_portal_snapshots WHERE core_has_data = true AND last_refreshed_at < now() - interval '5 minutes')
  )
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
  v_sync jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  PERFORM public.process_customer_portal_projection_events(greatest(1, least(coalesce(_limit, 500), 2000)));

  FOR v_row IN SELECT * FROM public.detect_customer_portal_projection_divergences(greatest(1, least(coalesce(_limit, 500), 10000))) LOOP
    v_checked := v_checked + 1;
    v_divergences := v_divergences || jsonb_build_array(jsonb_build_object('user_id', v_row.user_id, 'type', v_row.divergence_type, 'severity', v_row.severity, 'details', v_row.details));
    IF _repair THEN
      BEGIN
        PERFORM public.refresh_customer_portal_snapshot_internal(v_row.user_id, 'global_validation_repair', NULL);
        v_repaired := v_repaired + 1;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed || jsonb_build_array(jsonb_build_object('user_id', v_row.user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
        INSERT INTO public.customer_portal_projection_logs (user_id, event_source, status, message, details)
        VALUES (v_row.user_id, 'global_validation', 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE, 'divergence', v_row.divergence_type));
        INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
        VALUES (v_row.user_id, 'projection_repair_failed', 'critical', 'La réparation automatique du snapshot portail a échoué.', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'divergence', v_row.divergence_type));
      END;
    END IF;
  END LOOP;

  v_sync := public.customer_portal_realtime_sync_verifier(5);
  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('global_validation', CASE WHEN jsonb_array_length(v_failed) = 0 THEN 'success' ELSE 'warning' END, 'Validation globale du portail client exécutée', jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed, 'divergences', v_divergences, 'realtime', v_sync));

  RETURN jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed, 'divergences', v_divergences, 'realtime', v_sync);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_mark_notification_read(_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  UPDATE public.notifications n SET is_read = true, read_at = coalesce(n.read_at, now()) WHERE n.id = _notification_id AND (n.user_id = auth.uid() OR public.is_portal_projection_staff(auth.uid())) RETURNING n.user_id INTO v_uid;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Notification introuvable'; END IF;
  PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, 'notification_mark_read', _notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_mark_all_notifications_read(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.notifications n SET is_read = true, read_at = coalesce(n.read_at, now()) WHERE n.user_id = _user_id AND n.is_read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.refresh_customer_portal_snapshot_internal(_user_id, 'notifications_mark_all_read', NULL);
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  t text;
  is_table boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','accounts','billing_customers','orders','order_lifecycle','order_status_history','order_automation_log','billing_invoices','monthly_invoices','billing_payments','payments','contracts','client_auto_documents','client_documents','order_documents','payment_proofs','billing_subscriptions','billing_subscription_services','billing_subscription_trace_audit','service_instances','service_addresses','equipment_inventory','equipment_order_lines','equipment_audit_log','phone_orders','appointments','support_tickets','ticket_replies','ticket_attachments','replacement_tickets','replacement_orders','replacement_request_tickets','replacement_shipments','replacement_timeline','service_cancellation_requests','payment_methods','authorized_users','web_form_threads','web_form_messages','loyalty_points','loyalty_transactions','identity_verification_sessions','kyc_requested_documents','document_requests','notifications','channel_selections','payment_disputes','account_service_locations'
  ] LOOP
    SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r','p')) INTO is_table;
    IF is_table THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_customer_portal_projection_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_customer_portal_projection_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_portal_projection_event()', t, t);
    END IF;
  END LOOP;
END $$;

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
END $$;

REVOKE EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_realtime_sync_verifier(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_realtime_sync_verifier(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_realtime_sync_verifier(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_mark_notification_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_mark_notification_read(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_mark_all_notifications_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_mark_all_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_mark_all_notifications_read(uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_events_guard ON public.customer_portal_projection_events(status, created_at, user_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_alerts_open ON public.customer_portal_projection_alerts(status, severity, detected_at DESC);