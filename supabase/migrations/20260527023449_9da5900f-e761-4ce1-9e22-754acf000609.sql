CREATE OR REPLACE FUNCTION public.customer_portal_snapshot_array_count(_snapshot jsonb, _key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(coalesce(_snapshot, '{}'::jsonb) -> _key) = 'array'
    THEN jsonb_array_length(coalesce(_snapshot, '{}'::jsonb) -> _key)
    ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_projection_domain_counts(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'dashboard', CASE WHEN coalesce(_snapshot->'account', 'null'::jsonb) <> 'null'::jsonb OR public.customer_portal_snapshot_array_count(_snapshot, 'orders') > 0 OR public.customer_portal_snapshot_array_count(_snapshot, 'subscriptions') > 0 THEN 1 ELSE 0 END,
    'services', public.customer_portal_snapshot_array_count(_snapshot, 'subscriptions') + public.customer_portal_snapshot_array_count(_snapshot, 'serviceInstances'),
    'orders', public.customer_portal_snapshot_array_count(_snapshot, 'orders') + public.customer_portal_snapshot_array_count(_snapshot, 'phoneOrders'),
    'invoices', public.customer_portal_snapshot_array_count(_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(_snapshot, 'monthlyInvoices'),
    'payments', public.customer_portal_snapshot_array_count(_snapshot, 'payments') + public.customer_portal_snapshot_array_count(_snapshot, 'legacyPayments'),
    'transactions', public.customer_portal_snapshot_array_count(_snapshot, 'payments') + public.customer_portal_snapshot_array_count(_snapshot, 'legacyPayments') + public.customer_portal_snapshot_array_count(_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(_snapshot, 'monthlyInvoices'),
    'ledger', public.customer_portal_snapshot_array_count(_snapshot, 'payments') + public.customer_portal_snapshot_array_count(_snapshot, 'legacyPayments') + public.customer_portal_snapshot_array_count(_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(_snapshot, 'monthlyInvoices'),
    'contracts', public.customer_portal_snapshot_array_count(_snapshot, 'contracts'),
    'equipment', public.customer_portal_snapshot_array_count(_snapshot, 'equipment'),
    'tickets', public.customer_portal_snapshot_array_count(_snapshot, 'supportTickets') + public.customer_portal_snapshot_array_count(_snapshot, 'replacementTickets'),
    'appointments', public.customer_portal_snapshot_array_count(_snapshot, 'appointments'),
    'documents', public.customer_portal_snapshot_array_count(_snapshot, 'autoDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'clientDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'orderDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'paymentProofs') + public.customer_portal_snapshot_array_count(_snapshot, 'documentRequests'),
    'notifications', public.customer_portal_snapshot_array_count(_snapshot, 'notifications'),
    'activity', public.customer_portal_snapshot_array_count(_snapshot, 'activity'),
    'profile', CASE WHEN coalesce(_snapshot->'profile', 'null'::jsonb) <> 'null'::jsonb THEN 1 ELSE 0 END,
    'paymentMethods', public.customer_portal_snapshot_array_count(_snapshot, 'paymentMethods'),
    'loyalty', public.customer_portal_snapshot_array_count(_snapshot, 'loyaltyPoints') + public.customer_portal_snapshot_array_count(_snapshot, 'loyaltyTransactions'),
    'webForms', public.customer_portal_snapshot_array_count(_snapshot, 'webFormThreads')
  )
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_snapshot_domain_empty(_counts jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_each_text(coalesce(_counts, '{}'::jsonb)) AS kv(key, value)
    WHERE coalesce(value::integer, 0) > 0 AND key NOT IN ('dashboard', 'profile')
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_customer_portal_snapshot(_user_id uuid, _snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_counts jsonb := public.customer_portal_projection_domain_counts(coalesce(_snapshot, '{}'::jsonb));
  v_errors jsonb := '[]'::jsonb;
  v_core_has_data boolean := public.customer_portal_core_has_data(_user_id);
  v_portal_empty boolean := public.customer_portal_snapshot_domain_empty(v_counts);
BEGIN
  IF v_core_has_data AND v_portal_empty THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'PORTAL_EMPTY_CORE_POPULATED', 'severity', 'critical', 'message', 'Core contient des données client mais la projection portail ne contient aucune donnée métier.', 'sectionCounts', v_counts));
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'valid' ELSE 'invalid' END, 'errors', v_errors, 'sectionCounts', v_counts, 'coreHasData', v_core_has_data, 'portalEmpty', v_portal_empty);
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
  v_is_stale := NOT FOUND OR v_cached.last_refreshed_at < now() - interval '15 seconds' OR v_cached.validation_status <> 'valid' OR (v_cached.core_has_data = true AND v_cached.portal_empty = true);

  IF v_is_stale THEN
    RETURN public.refresh_customer_portal_snapshot_internal(_user_id, 'read_hydration_repair', NULL);
  END IF;

  RETURN v_cached.snapshot || jsonb_build_object('projection', jsonb_build_object('source', 'customer_portal_snapshot', 'version', v_cached.projection_version, 'lastRefreshedAt', v_cached.last_refreshed_at, 'sectionCounts', v_cached.section_counts, 'validationStatus', v_cached.validation_status, 'validationErrors', v_cached.validation_errors, 'coreHasData', v_cached.core_has_data, 'portalEmpty', v_cached.portal_empty, 'stale', false));
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_customer_portal_projection_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_customer_id uuid;
  v_account_id uuid;
  v_order_id uuid;
  v_subscription_id uuid;
  v_ticket_id uuid;
  v_row_id uuid;
  v_uid uuid;
  v_event_id uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_customer_id := nullif(to_jsonb(r)->>'customer_id', '')::uuid;
  v_account_id := nullif(to_jsonb(r)->>'account_id', '')::uuid;
  v_order_id := coalesce(nullif(to_jsonb(r)->>'order_id', '')::uuid, nullif(to_jsonb(r)->>'related_order_id', '')::uuid, nullif(to_jsonb(r)->>'original_order_id', '')::uuid);
  v_subscription_id := nullif(to_jsonb(r)->>'subscription_id', '')::uuid;
  v_ticket_id := coalesce(nullif(to_jsonb(r)->>'ticket_id', '')::uuid, nullif(to_jsonb(r)->>'support_ticket_id', '')::uuid);
  v_row_id := nullif(to_jsonb(r)->>'id', '')::uuid;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL) INTO v_user_ids
  FROM (
    SELECT nullif(to_jsonb(r)->>'user_id', '')::uuid AS user_id
    UNION SELECT nullif(to_jsonb(r)->>'client_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'owner_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'created_by_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'linked_user_id', '')::uuid
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.id = v_customer_id
    UNION SELECT a.client_id FROM public.accounts a WHERE a.id = v_account_id
    UNION SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id
    UNION SELECT a.client_id FROM public.accounts a JOIN public.orders o ON o.account_id = a.id WHERE o.id = v_order_id
    UNION SELECT bc.user_id FROM public.billing_customers bc JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id WHERE bs.id = v_subscription_id
    UNION SELECT st.user_id FROM public.support_tickets st WHERE st.id = v_ticket_id
    UNION SELECT st.owner_user_id FROM public.support_tickets st WHERE st.id = v_ticket_id
  ) u;

  FOREACH v_uid IN ARRAY coalesce(v_user_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.customer_portal_projection_events (user_id, event_source, event_id, payload, status)
    VALUES (v_uid, TG_TABLE_NAME, v_row_id, jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME), 'processing')
    RETURNING id INTO v_event_id;

    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, TG_TABLE_NAME, v_row_id);
      UPDATE public.customer_portal_projection_events SET status = 'processed', processed_at = now(), attempts = attempts + 1 WHERE id = v_event_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.customer_portal_projection_events SET status = 'failed', attempts = attempts + 1, last_error = SQLERRM WHERE id = v_event_id;
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, message, details)
      VALUES (v_uid, TG_TABLE_NAME, v_row_id, 'error', SQLERRM, jsonb_build_object('operation', TG_OP, 'sqlstate', SQLSTATE));
      INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
      VALUES (v_uid, 'projection_rebuild_failed', 'critical', 'La reconstruction automatique du portail client a échoué.', jsonb_build_object('table', TG_TABLE_NAME, 'source_id', v_row_id, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_global_validation(_limit integer DEFAULT 500, _repair boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_checked integer := 0;
  v_repaired integer := 0;
  v_failed jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  FOR v_uid IN
    SELECT candidate.user_id FROM (
      SELECT m.user_id, 0 AS priority FROM public.detect_missing_customer_portal_projections() m
      UNION ALL SELECT s.user_id, 1 FROM public.customer_portal_snapshots s WHERE s.core_has_data = true AND s.portal_empty = true
      UNION ALL SELECT s.user_id, 2 FROM public.customer_portal_snapshots s WHERE s.validation_status <> 'valid'
      UNION ALL SELECT s.user_id, 3 FROM public.customer_portal_snapshots s WHERE s.core_has_data = true AND s.last_refreshed_at < now() - interval '2 minutes'
      UNION ALL SELECT p.user_id, 4 FROM public.profiles p WHERE p.user_id IS NOT NULL
      UNION ALL SELECT a.client_id, 4 FROM public.accounts a WHERE a.client_id IS NOT NULL
      UNION ALL SELECT bc.user_id, 4 FROM public.billing_customers bc WHERE bc.user_id IS NOT NULL
      UNION ALL SELECT o.user_id, 4 FROM public.orders o WHERE o.user_id IS NOT NULL
    ) candidate WHERE candidate.user_id IS NOT NULL GROUP BY candidate.user_id ORDER BY min(candidate.priority) LIMIT greatest(1, least(coalesce(_limit, 500), 2000))
  LOOP
    v_checked := v_checked + 1;
    BEGIN
      IF _repair THEN
        PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, 'global_validation_repair', NULL);
        v_repaired := v_repaired + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object('user_id', v_uid, 'error', SQLERRM, 'sqlstate', SQLSTATE));
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, status, message, details)
      VALUES (v_uid, 'global_validation', 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    END;
  END LOOP;

  INSERT INTO public.customer_portal_projection_logs (event_source, status, message, details)
  VALUES ('global_validation', CASE WHEN jsonb_array_length(v_failed) = 0 THEN 'success' ELSE 'warning' END, 'Validation globale du portail client exécutée', jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed));
  RETURN jsonb_build_object('checked', v_checked, 'repaired', v_repaired, 'failures', v_failed);
END;
$$;

DO $$
DECLARE
  t text;
  is_table boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','accounts','billing_customers','orders','order_lifecycle','order_status_history','order_automation_log','billing_invoices','monthly_invoices','billing_payments','payments','contracts','client_auto_documents','client_documents','order_documents','payment_proofs','billing_subscriptions','billing_subscription_services','billing_subscription_trace_audit','service_instances','service_addresses','equipment_inventory','equipment_order_lines','equipment_audit_log','phone_orders','appointments','support_tickets','ticket_replies','ticket_attachments','replacement_tickets','replacement_orders','service_cancellation_requests','payment_methods','authorized_users','web_form_threads','web_form_messages','loyalty_points','loyalty_transactions','identity_verification_sessions','kyc_requested_documents','document_requests','notifications','channel_selections'
  ] LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r','p')
    ) INTO is_table;
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

REVOKE EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_global_validation(integer, boolean) TO service_role;

CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_events_user_status ON public.customer_portal_projection_events(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_snapshots_validation_guard ON public.customer_portal_snapshots(core_has_data, portal_empty, validation_status, last_refreshed_at DESC);
