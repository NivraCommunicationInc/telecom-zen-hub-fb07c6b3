CREATE TABLE IF NOT EXISTS public.customer_portal_snapshots (
  user_id uuid PRIMARY KEY,
  account_id uuid,
  customer_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  account_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  order_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  subscription_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  core_has_data boolean NOT NULL DEFAULT false,
  portal_empty boolean NOT NULL DEFAULT true,
  validation_status text NOT NULL DEFAULT 'pending',
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  projection_version integer NOT NULL DEFAULT 1,
  last_event_source text,
  last_event_id uuid,
  last_refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_portal_snapshots TO authenticated;
GRANT ALL ON public.customer_portal_snapshots TO service_role;
ALTER TABLE public.customer_portal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_portal_projection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_source text NOT NULL,
  event_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.customer_portal_projection_events TO authenticated;
GRANT ALL ON public.customer_portal_projection_events TO service_role;
ALTER TABLE public.customer_portal_projection_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_portal_projection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_source text NOT NULL,
  event_id uuid,
  status text NOT NULL DEFAULT 'success',
  section_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_portal_projection_logs TO authenticated;
GRANT ALL ON public.customer_portal_projection_logs TO service_role;
ALTER TABLE public.customer_portal_projection_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_portal_projection_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  status text NOT NULL DEFAULT 'open',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT, UPDATE ON public.customer_portal_projection_alerts TO authenticated;
GRANT ALL ON public.customer_portal_projection_alerts TO service_role;
ALTER TABLE public.customer_portal_projection_alerts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_portal_projection_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'employee')
      OR public.has_role(_user_id, 'support')
      OR public.has_role(_user_id, 'supervisor')
      OR public.has_role(_user_id, 'billing_admin')
      OR public.has_role(_user_id, 'techops')
$$;

DROP POLICY IF EXISTS "Clients read own portal snapshot" ON public.customer_portal_snapshots;
CREATE POLICY "Clients read own portal snapshot"
ON public.customer_portal_snapshots
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_portal_projection_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read portal projection events" ON public.customer_portal_projection_events;
CREATE POLICY "Staff read portal projection events"
ON public.customer_portal_projection_events
FOR SELECT
TO authenticated
USING (public.is_portal_projection_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read portal projection logs" ON public.customer_portal_projection_logs;
CREATE POLICY "Staff read portal projection logs"
ON public.customer_portal_projection_logs
FOR SELECT
TO authenticated
USING (public.is_portal_projection_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff manage portal projection alerts" ON public.customer_portal_projection_alerts;
CREATE POLICY "Staff manage portal projection alerts"
ON public.customer_portal_projection_alerts
FOR ALL
TO authenticated
USING (public.is_portal_projection_staff(auth.uid()))
WITH CHECK (public.is_portal_projection_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.portal_jsonb_array_count(_snapshot jsonb, _key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(coalesce(_snapshot, '{}'::jsonb) -> _key) = 'array' THEN jsonb_array_length(coalesce(_snapshot, '{}'::jsonb) -> _key)
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_section_counts(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'dashboard', CASE WHEN coalesce(_snapshot->'account', 'null'::jsonb) <> 'null'::jsonb OR public.portal_jsonb_array_count(_snapshot, 'orders') > 0 OR public.portal_jsonb_array_count(_snapshot, 'subscriptions') > 0 THEN 1 ELSE 0 END,
    'services', public.portal_jsonb_array_count(_snapshot, 'subscriptions') + public.portal_jsonb_array_count(_snapshot, 'serviceInstances'),
    'orders', public.portal_jsonb_array_count(_snapshot, 'orders') + public.portal_jsonb_array_count(_snapshot, 'phoneOrders'),
    'invoices', public.portal_jsonb_array_count(_snapshot, 'invoices') + public.portal_jsonb_array_count(_snapshot, 'monthlyInvoices'),
    'payments', public.portal_jsonb_array_count(_snapshot, 'payments') + public.portal_jsonb_array_count(_snapshot, 'legacyPayments'),
    'contracts', public.portal_jsonb_array_count(_snapshot, 'contracts'),
    'equipment', public.portal_jsonb_array_count(_snapshot, 'equipment'),
    'tickets', public.portal_jsonb_array_count(_snapshot, 'supportTickets') + public.portal_jsonb_array_count(_snapshot, 'replacementTickets'),
    'appointments', public.portal_jsonb_array_count(_snapshot, 'appointments'),
    'documents', public.portal_jsonb_array_count(_snapshot, 'autoDocuments') + public.portal_jsonb_array_count(_snapshot, 'clientDocuments') + public.portal_jsonb_array_count(_snapshot, 'orderDocuments') + public.portal_jsonb_array_count(_snapshot, 'paymentProofs') + public.portal_jsonb_array_count(_snapshot, 'documentRequests'),
    'transactions', public.portal_jsonb_array_count(_snapshot, 'payments') + public.portal_jsonb_array_count(_snapshot, 'legacyPayments') + public.portal_jsonb_array_count(_snapshot, 'invoices') + public.portal_jsonb_array_count(_snapshot, 'monthlyInvoices'),
    'ledger', public.portal_jsonb_array_count(_snapshot, 'payments') + public.portal_jsonb_array_count(_snapshot, 'legacyPayments') + public.portal_jsonb_array_count(_snapshot, 'invoices') + public.portal_jsonb_array_count(_snapshot, 'monthlyInvoices'),
    'notifications', public.portal_jsonb_array_count(_snapshot, 'notifications'),
    'activity', public.portal_jsonb_array_count(_snapshot, 'activity')
  )
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_snapshot_is_empty(_counts jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_each_text(coalesce(_counts, '{}'::jsonb)) AS kv(key, value)
    WHERE coalesce(value::integer, 0) > 0
      AND key <> 'dashboard'
  )
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_core_has_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.client_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.billing_customers bc WHERE bc.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.monthly_invoices mi WHERE mi.client_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = _user_id OR p.client_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.user_id = _user_id OR st.owner_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.appointments ap WHERE ap.client_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.validate_customer_portal_snapshot(_user_id uuid, _snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_counts jsonb := public.customer_portal_section_counts(coalesce(_snapshot, '{}'::jsonb));
  v_errors jsonb := '[]'::jsonb;
  v_core_has_data boolean := public.customer_portal_core_has_data(_user_id);
  v_portal_empty boolean := public.customer_portal_snapshot_is_empty(v_counts);
BEGIN
  IF v_core_has_data AND v_portal_empty THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'PORTAL_EMPTY_CORE_POPULATED', 'message', 'Core contient des données client mais la projection portail est vide.'));
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'valid' ELSE 'invalid' END,
    'errors', v_errors,
    'sectionCounts', v_counts,
    'coreHasData', v_core_has_data,
    'portalEmpty', v_portal_empty
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_customer_portal_snapshot_internal(_user_id uuid, _event_source text DEFAULT 'manual', _event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_snapshot jsonb;
  v_validation jsonb;
  v_identifiers jsonb;
  v_account_id uuid;
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  v_snapshot := public.get_client_history_snapshot(_user_id);

  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_notifications
  FROM public.notifications n
  WHERE n.user_id = _user_id;
  v_snapshot := v_snapshot || jsonb_build_object('notifications', v_notifications);

  v_validation := public.validate_customer_portal_snapshot(_user_id, v_snapshot);
  v_identifiers := coalesce(v_snapshot->'identifiers', '{}'::jsonb);
  v_account_id := nullif(v_identifiers->>'accountId', '')::uuid;

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_customer_ids FROM jsonb_array_elements_text(coalesce(v_identifiers->'customerIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_account_ids FROM jsonb_array_elements_text(coalesce(v_identifiers->'accountIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_order_ids FROM jsonb_array_elements_text(coalesce(v_identifiers->'orderIds', '[]'::jsonb)) AS value;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_subscription_ids FROM jsonb_array_elements_text(coalesce(v_identifiers->'subscriptionIds', '[]'::jsonb)) AS value;

  INSERT INTO public.customer_portal_snapshots (user_id, account_id, customer_ids, account_ids, order_ids, subscription_ids, snapshot, section_counts, core_has_data, portal_empty, validation_status, validation_errors, last_event_source, last_event_id, last_refreshed_at, updated_at)
  VALUES (_user_id, v_account_id, v_customer_ids, v_account_ids, v_order_ids, v_subscription_ids, v_snapshot, v_validation->'sectionCounts', (v_validation->>'coreHasData')::boolean, (v_validation->>'portalEmpty')::boolean, v_validation->>'status', v_validation->'errors', _event_source, _event_id, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    customer_ids = EXCLUDED.customer_ids,
    account_ids = EXCLUDED.account_ids,
    order_ids = EXCLUDED.order_ids,
    subscription_ids = EXCLUDED.subscription_ids,
    snapshot = EXCLUDED.snapshot,
    section_counts = EXCLUDED.section_counts,
    core_has_data = EXCLUDED.core_has_data,
    portal_empty = EXCLUDED.portal_empty,
    validation_status = EXCLUDED.validation_status,
    validation_errors = EXCLUDED.validation_errors,
    projection_version = public.customer_portal_snapshots.projection_version + 1,
    last_event_source = EXCLUDED.last_event_source,
    last_event_id = EXCLUDED.last_event_id,
    last_refreshed_at = now(),
    updated_at = now();

  INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, section_counts, message, details)
  VALUES (_user_id, coalesce(_event_source, 'manual'), _event_id, v_validation->>'status', v_validation->'sectionCounts', 'Projection portail client rafraîchie', v_validation);

  IF (v_validation->>'coreHasData')::boolean AND (v_validation->>'portalEmpty')::boolean THEN
    INSERT INTO public.customer_portal_projection_alerts (user_id, account_id, alert_type, severity, message, details)
    VALUES (_user_id, v_account_id, 'portal_empty_core_populated', 'critical', 'Projection portail vide alors que Core contient des données.', v_validation);
  ELSE
    UPDATE public.customer_portal_projection_alerts
    SET status = 'resolved', resolved_at = now()
    WHERE user_id = _user_id AND alert_type = 'portal_empty_core_populated' AND status = 'open';
  END IF;

  RETURN v_snapshot || jsonb_build_object('projection', jsonb_build_object('source', 'customer_portal_snapshot', 'version', coalesce((SELECT projection_version FROM public.customer_portal_snapshots WHERE user_id = _user_id), 1), 'lastRefreshedAt', now(), 'sectionCounts', v_validation->'sectionCounts', 'validationStatus', v_validation->>'status', 'validationErrors', v_validation->'errors', 'coreHasData', (v_validation->>'coreHasData')::boolean, 'portalEmpty', (v_validation->>'portalEmpty')::boolean));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, message, details)
  VALUES (_user_id, coalesce(_event_source, 'manual'), _event_id, 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_customer_portal_snapshot(_user_id uuid, _event_source text DEFAULT 'manual', _event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN public.refresh_customer_portal_snapshot_internal(_user_id, _event_source, _event_id);
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO v_cached FROM public.customer_portal_snapshots WHERE user_id = _user_id;
  IF NOT FOUND OR v_cached.last_refreshed_at < now() - interval '2 minutes' OR v_cached.validation_status <> 'valid' THEN
    RETURN public.refresh_customer_portal_snapshot_internal(_user_id, 'read_hydration', NULL);
  END IF;

  RETURN v_cached.snapshot || jsonb_build_object('projection', jsonb_build_object('source', 'customer_portal_snapshot', 'version', v_cached.projection_version, 'lastRefreshedAt', v_cached.last_refreshed_at, 'sectionCounts', v_cached.section_counts, 'validationStatus', v_cached.validation_status, 'validationErrors', v_cached.validation_errors, 'coreHasData', v_cached.core_has_data, 'portalEmpty', v_cached.portal_empty));
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_customer_portal_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN public.refresh_customer_portal_snapshot_internal(_user_id, 'manual_repair', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_customer_portal_projection_events(_limit integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_event record;
  v_processed integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  FOR v_event IN
    SELECT * FROM public.customer_portal_projection_events
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT greatest(1, least(coalesce(_limit, 50), 200))
  LOOP
    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(v_event.user_id, v_event.event_source, v_event.event_id);
      UPDATE public.customer_portal_projection_events SET status = 'processed', processed_at = now(), attempts = attempts + 1 WHERE id = v_event.id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.customer_portal_projection_events SET attempts = attempts + 1, last_error = SQLERRM, status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END WHERE id = v_event.id;
    END;
  END LOOP;

  RETURN v_processed;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_portal_empty_core_populated()
RETURNS TABLE(user_id uuid, account_id uuid, section_counts jsonb, validation_errors jsonb, last_refreshed_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, s.account_id, s.section_counts, s.validation_errors, s.last_refreshed_at
  FROM public.customer_portal_snapshots s
  WHERE s.core_has_data = true AND s.portal_empty = true AND s.validation_status <> 'valid'
  ORDER BY s.last_refreshed_at DESC
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
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_customer_id := nullif(to_jsonb(r)->>'customer_id', '')::uuid;
  v_account_id := nullif(to_jsonb(r)->>'account_id', '')::uuid;
  v_order_id := coalesce(nullif(to_jsonb(r)->>'order_id', '')::uuid, nullif(to_jsonb(r)->>'related_order_id', '')::uuid);
  v_subscription_id := nullif(to_jsonb(r)->>'subscription_id', '')::uuid;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL) INTO v_user_ids
  FROM (
    SELECT nullif(to_jsonb(r)->>'user_id', '')::uuid AS user_id
    UNION SELECT nullif(to_jsonb(r)->>'client_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'owner_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'created_by_user_id', '')::uuid
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.id = v_customer_id
    UNION SELECT a.client_id FROM public.accounts a WHERE a.id = v_account_id
    UNION SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id
    UNION SELECT a.client_id FROM public.accounts a JOIN public.orders o ON o.account_id = a.id WHERE o.id = v_order_id
    UNION SELECT bc.user_id FROM public.billing_customers bc JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id WHERE bs.id = v_subscription_id
  ) u;

  INSERT INTO public.customer_portal_projection_events (user_id, event_source, event_id, payload)
  SELECT uid, TG_TABLE_NAME, nullif(to_jsonb(r)->>'id', '')::uuid, jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
  FROM unnest(coalesce(v_user_ids, ARRAY[]::uuid[])) AS uid
  WHERE uid IS NOT NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','accounts','billing_customers','orders','billing_invoices','monthly_invoices','billing_payments','payments','contracts','client_auto_documents','client_documents','order_documents','payment_proofs','billing_subscriptions','service_instances','service_addresses','equipment_inventory','phone_orders','appointments','support_tickets','replacement_tickets','replacement_orders','service_cancellation_requests','payment_methods','authorized_users','web_form_threads','loyalty_points','loyalty_transactions','identity_verification_sessions','document_requests','notifications'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_customer_portal_projection_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_customer_portal_projection_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_portal_projection_event()', t, t);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_customer_portal_snapshot(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_customer_portal_snapshot(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_customer_portal_snapshot(uuid, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.repair_customer_portal_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.repair_customer_portal_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_customer_portal_snapshot(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_customer_portal_projection_events(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_customer_portal_projection_events(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_customer_portal_projection_events(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_portal_empty_core_populated() FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_portal_empty_core_populated() TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_portal_empty_core_populated() TO service_role;

CREATE INDEX IF NOT EXISTS idx_customer_portal_snapshots_account_id ON public.customer_portal_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_snapshots_last_refreshed ON public.customer_portal_snapshots(last_refreshed_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_events_pending ON public.customer_portal_projection_events(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_logs_user_created ON public.customer_portal_projection_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_portal_projection_alerts_status ON public.customer_portal_projection_alerts(status, severity, detected_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_snapshots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_snapshots;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_alerts;
  END IF;
END $$;