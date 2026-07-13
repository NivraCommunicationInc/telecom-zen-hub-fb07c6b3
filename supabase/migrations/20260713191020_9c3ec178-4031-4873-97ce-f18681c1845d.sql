-- Appointment visibility + legacy synchronization hardening
-- Keeps public.appointments as the canonical appointment registry used by Core and customer portal.

CREATE OR REPLACE FUNCTION public.fn_parse_legacy_slot_start(_slot text)
RETURNS time
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text := lower(coalesce(_slot, ''));
  h int;
  m int := 0;
BEGIN
  IF btrim(v) = '' THEN
    RETURN '09:00'::time;
  END IF;

  IF v ~ '^\s*[0-9]{1,2}:[0-9]{2}' THEN
    RETURN substring(v from '^\s*([0-9]{1,2}:[0-9]{2})')::time;
  END IF;

  IF v ~ '^\s*[0-9]{1,2}\s*h\s*[0-9]{2}' THEN
    h := substring(v from '^\s*([0-9]{1,2})\s*h')::int;
    m := substring(v from '^\s*[0-9]{1,2}\s*h\s*([0-9]{2})')::int;
    RETURN make_time(least(greatest(h, 0), 23), least(greatest(m, 0), 59), 0);
  END IF;

  IF v ~ '^\s*[0-9]{1,2}\s*h' THEN
    h := substring(v from '^\s*([0-9]{1,2})\s*h')::int;
    RETURN make_time(least(greatest(h, 0), 23), 0, 0);
  END IF;

  IF v LIKE '%morning%' OR v LIKE '%matin%' THEN
    RETURN '09:00'::time;
  ELSIF v LIKE '%afternoon%' OR v LIKE '%après%' OR v LIKE '%apres%' THEN
    RETURN '13:00'::time;
  ELSIF v LIKE '%evening%' OR v LIKE '%soir%' THEN
    RETURN '17:00'::time;
  END IF;

  RETURN '09:00'::time;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_resolve_service_address_for_links(
  _account_id uuid DEFAULT NULL,
  _order_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _service_address text DEFAULT NULL,
  _service_city text DEFAULT NULL,
  _postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid := _account_id;
  v_order record;
  v_addr uuid;
BEGIN
  IF _order_id IS NOT NULL THEN
    SELECT o.id, o.account_id, o.user_id, o.service_address_id, o.shipping_address, o.service_address,
           o.client_full_address, o.shipping_city, o.service_city, o.shipping_postal_code, o.service_postal_code
    INTO v_order
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;

    IF FOUND THEN
      IF v_order.service_address_id IS NOT NULL THEN
        RETURN v_order.service_address_id;
      END IF;
      v_account_id := coalesce(v_account_id, v_order.account_id);
    END IF;
  END IF;

  IF v_account_id IS NULL AND _client_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.client_id = _client_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
    AND (
      nullif(btrim(coalesce(_postal_code, '')), '') IS NOT NULL
      AND lower(regexp_replace(coalesce(sa.postal_code, ''), '\\s+', '', 'g')) = lower(regexp_replace(_postal_code, '\\s+', '', 'g'))
    )
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;
  IF v_addr IS NOT NULL THEN RETURN v_addr; END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
    AND nullif(btrim(coalesce(_service_address, '')), '') IS NOT NULL
    AND lower(btrim(sa.address_line)) = lower(btrim(_service_address))
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;
  IF v_addr IS NOT NULL THEN RETURN v_addr; END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;

  RETURN v_addr;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_resolve_account_service_address_id(_account_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.fn_resolve_service_address_for_links(_account_id, NULL, NULL, NULL, NULL, NULL)
$$;

CREATE OR REPLACE FUNCTION public.fn_normalize_appointment_service_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_account_id uuid;
BEGIN
  IF NEW.environment IS NULL OR lower(btrim(NEW.environment)) IN ('', 'production', 'prod') THEN
    NEW.environment := 'live';
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, o.client_email, o.client_phone, o.service_address_id,
           coalesce(o.service_address, o.shipping_address, o.client_full_address) AS addr,
           coalesce(o.service_city, o.shipping_city) AS city,
           coalesce(o.service_postal_code, o.shipping_postal_code) AS postal,
           o.service_type
    INTO v_order
    FROM public.orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;

    IF FOUND THEN
      v_account_id := v_order.account_id;
      NEW.client_id := coalesce(NEW.client_id, v_order.user_id);
      NEW.client_email := coalesce(nullif(NEW.client_email, ''), v_order.client_email);
      NEW.client_phone := coalesce(nullif(NEW.client_phone, ''), v_order.client_phone);
      NEW.service_address := coalesce(nullif(NEW.service_address, ''), v_order.addr);
      NEW.service_city := coalesce(nullif(NEW.service_city, ''), v_order.city);
      NEW.service_postal_code := coalesce(nullif(NEW.service_postal_code, ''), v_order.postal);
      NEW.service_type := coalesce(nullif(NEW.service_type, ''), v_order.service_type, 'installation');
      NEW.service_address_id := coalesce(NEW.service_address_id, v_order.service_address_id);
    END IF;
  END IF;

  IF v_account_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.client_id = NEW.client_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF NEW.service_address_id IS NULL THEN
    NEW.service_address_id := public.fn_resolve_service_address_for_links(
      v_account_id,
      NEW.order_id,
      NEW.client_id,
      NEW.service_address,
      NEW.service_city,
      NEW.service_postal_code
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_upsert_canonical_appointment_from_legacy(
  _source text,
  _source_id uuid,
  _order_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _account_id uuid DEFAULT NULL,
  _service_address_id uuid DEFAULT NULL,
  _technician_id uuid DEFAULT NULL,
  _scheduled_at timestamptz DEFAULT NULL,
  _status text DEFAULT NULL,
  _service_address text DEFAULT NULL,
  _service_city text DEFAULT NULL,
  _service_postal_code text DEFAULT NULL,
  _client_email text DEFAULT NULL,
  _client_phone text DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _title text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_addr uuid;
  v_order record;
  v_status text := lower(coalesce(nullif(_status, ''), 'scheduled'));
  v_notes text;
  v_title text;
BEGIN
  IF _scheduled_at IS NULL AND _technician_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_status IN ('pending') THEN v_status := 'scheduled'; END IF;
  IF v_status IN ('done', 'complete') THEN v_status := 'completed'; END IF;

  IF _order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, o.client_email, o.client_phone, o.order_number,
           coalesce(o.service_address, o.shipping_address, o.client_full_address) AS addr,
           coalesce(o.service_city, o.shipping_city) AS city,
           coalesce(o.service_postal_code, o.shipping_postal_code) AS postal,
           o.service_address_id, o.service_type
    INTO v_order
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;
  END IF;

  v_addr := coalesce(
    _service_address_id,
    public.fn_resolve_service_address_for_links(
      coalesce(_account_id, v_order.account_id),
      _order_id,
      coalesce(_client_id, v_order.user_id),
      coalesce(nullif(_service_address, ''), v_order.addr),
      coalesce(nullif(_service_city, ''), v_order.city),
      coalesce(nullif(_service_postal_code, ''), v_order.postal)
    )
  );

  SELECT ap.id INTO v_existing
  FROM public.appointments ap
  WHERE (_order_id IS NOT NULL AND ap.order_id = _order_id)
     OR ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%')
  ORDER BY CASE WHEN ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%') THEN 0 ELSE 1 END,
           ap.updated_at DESC NULLS LAST,
           ap.created_at DESC NULLS LAST
  LIMIT 1;

  v_notes := concat_ws(E'\n', nullif(_notes, ''), 'legacy_source=' || _source || ':' || _source_id::text);
  v_title := coalesce(nullif(_title, ''), CASE WHEN v_order.order_number IS NOT NULL THEN 'Installation — ' || v_order.order_number ELSE 'Installation' END);

  IF v_existing IS NOT NULL THEN
    UPDATE public.appointments ap SET
      order_id = coalesce(ap.order_id, _order_id),
      client_id = coalesce(ap.client_id, _client_id, v_order.user_id),
      client_email = coalesce(nullif(ap.client_email, ''), nullif(_client_email, ''), v_order.client_email),
      client_phone = coalesce(nullif(ap.client_phone, ''), nullif(_client_phone, ''), v_order.client_phone),
      technician_id = coalesce(_technician_id, ap.technician_id),
      scheduled_at = coalesce(_scheduled_at, ap.scheduled_at),
      status = coalesce(nullif(v_status, ''), ap.status, 'scheduled'),
      service_type = coalesce(nullif(_service_type, ''), ap.service_type, v_order.service_type, 'installation'),
      installation_method = coalesce(ap.installation_method, 'technician'),
      service_address_id = coalesce(ap.service_address_id, v_addr),
      service_address = coalesce(nullif(ap.service_address, ''), nullif(_service_address, ''), v_order.addr),
      service_city = coalesce(nullif(ap.service_city, ''), nullif(_service_city, ''), v_order.city),
      service_postal_code = coalesce(nullif(ap.service_postal_code, ''), nullif(_service_postal_code, ''), v_order.postal),
      title = coalesce(nullif(ap.title, ''), v_title),
      internal_notes = CASE WHEN ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%') THEN ap.internal_notes ELSE concat_ws(E'\n', ap.internal_notes, v_notes) END,
      environment = 'live',
      updated_at = now()
    WHERE ap.id = v_existing;
    RETURN v_existing;
  END IF;

  INSERT INTO public.appointments (
    order_id, client_id, client_email, client_phone, technician_id, scheduled_at, status,
    service_type, installation_method, service_address_id, service_address, service_city,
    service_postal_code, title, internal_notes, environment
  ) VALUES (
    _order_id,
    coalesce(_client_id, v_order.user_id),
    coalesce(nullif(_client_email, ''), v_order.client_email),
    coalesce(nullif(_client_phone, ''), v_order.client_phone),
    _technician_id,
    _scheduled_at,
    coalesce(nullif(v_status, ''), 'scheduled'),
    coalesce(nullif(_service_type, ''), v_order.service_type, 'installation'),
    'technician',
    v_addr,
    coalesce(nullif(_service_address, ''), v_order.addr),
    coalesce(nullif(_service_city, ''), v_order.city),
    coalesce(nullif(_service_postal_code, ''), v_order.postal),
    v_title,
    v_notes,
    'live'
  ) RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_installation_job_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scheduled timestamptz;
  v_appt_id uuid;
BEGIN
  IF NEW.scheduled_date IS NOT NULL THEN
    v_scheduled := (NEW.scheduled_date + coalesce(NEW.scheduled_time_start, '09:00'::time))::timestamptz;
  ELSE
    v_scheduled := coalesce(NEW.started_at, NEW.technician_assigned_at);
  END IF;

  v_appt_id := public.fn_upsert_canonical_appointment_from_legacy(
    'installation_jobs', NEW.id, NEW.order_id, NULL, NEW.account_id,
    coalesce(NEW.service_address_id, NEW.address_id), NEW.technician_id, v_scheduled,
    NEW.status, NEW.service_address, NEW.service_city, NEW.service_postal_code,
    NEW.client_email, NEW.client_phone, NEW.service_type, coalesce(NEW.job_number, 'Installation'),
    concat_ws(' — ', NEW.internal_notes, NEW.technician_notes, NEW.client_instructions)
  );

  IF v_appt_id IS NOT NULL AND NEW.appointment_id IS DISTINCT FROM v_appt_id THEN
    NEW.appointment_id := v_appt_id;
  END IF;
  IF NEW.service_address_id IS NULL AND v_appt_id IS NOT NULL THEN
    SELECT ap.service_address_id INTO NEW.service_address_id FROM public.appointments ap WHERE ap.id = v_appt_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_installation_job_to_appointment ON public.installation_jobs;
CREATE TRIGGER trg_sync_installation_job_to_appointment
BEFORE INSERT OR UPDATE OF order_id, account_id, address_id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end, status, service_address, service_city, service_postal_code, client_email, client_phone, service_type, internal_notes, technician_notes, client_instructions, service_address_id
ON public.installation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_installation_job_to_appointment();

CREATE OR REPLACE FUNCTION public.trg_sync_installation_appt_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appt_id uuid;
BEGIN
  v_appt_id := public.fn_upsert_canonical_appointment_from_legacy(
    'installation_appointments', NEW.id, NEW.order_id, NULL, NULL,
    NEW.service_address_id, NEW.technician_id, NEW.appointment_date,
    NEW.status, NULL, NULL, NULL, NULL, NULL, 'installation', 'Installation',
    concat_ws(' — ', NEW.notes, NEW.fee_notes, NEW.appointment_window)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_installation_appt_to_appointment ON public.installation_appointments;
CREATE TRIGGER trg_sync_installation_appt_to_appointment
AFTER INSERT OR UPDATE OF order_id, appointment_date, appointment_window, technician_id, status, notes, fee_notes, service_address_id
ON public.installation_appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_installation_appt_to_appointment();

CREATE OR REPLACE FUNCTION public.trg_sync_installation_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scheduled timestamptz;
BEGIN
  IF NEW.appointment_date IS NOT NULL THEN
    v_scheduled := (NEW.appointment_date + public.fn_parse_legacy_slot_start(NEW.time_slot))::timestamptz;
  END IF;

  PERFORM public.fn_upsert_canonical_appointment_from_legacy(
    'installations', NEW.id, NEW.order_id, NEW.client_id, NULL,
    NULL, NULL, v_scheduled, NEW.status::text,
    NEW.service_address, NEW.service_city, NEW.service_postal_code,
    NULL, NULL, 'installation', 'Installation', concat_ws(' — ', NEW.notes, NEW.time_slot)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_installation_to_appointment ON public.installations;
CREATE TRIGGER trg_sync_installation_to_appointment
AFTER INSERT OR UPDATE OF order_id, client_id, appointment_date, time_slot, status, service_address, service_city, service_postal_code, notes
ON public.installations
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_installation_to_appointment();

CREATE OR REPLACE FUNCTION public.trg_sync_slot_booking_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inst public.installations%ROWTYPE;
  v_scheduled timestamptz;
BEGIN
  IF NEW.slot_date IS NOT NULL THEN
    v_scheduled := (NEW.slot_date + public.fn_parse_legacy_slot_start(NEW.time_slot))::timestamptz;
  END IF;

  SELECT * INTO v_inst FROM public.installations i WHERE i.id = NEW.installation_id LIMIT 1;

  PERFORM public.fn_upsert_canonical_appointment_from_legacy(
    'technician_slot_bookings', NEW.id, coalesce(NEW.order_id, v_inst.order_id), coalesce(NEW.client_id, v_inst.client_id), NULL,
    NULL, NULL, v_scheduled, NEW.status,
    v_inst.service_address, v_inst.service_city, v_inst.service_postal_code,
    NULL, NULL, 'installation', 'Installation', concat_ws(' — ', NEW.time_slot, 'slot booking')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_slot_booking_to_appointment ON public.technician_slot_bookings;
CREATE TRIGGER trg_sync_slot_booking_to_appointment
AFTER INSERT OR UPDATE OF installation_id, client_id, order_id, slot_date, time_slot, status
ON public.technician_slot_bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_slot_booking_to_appointment();

CREATE OR REPLACE FUNCTION public.trg_sync_technician_assignment_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scheduled timestamptz;
BEGIN
  IF NEW.scheduled_date IS NOT NULL THEN
    v_scheduled := (NEW.scheduled_date + coalesce(NEW.scheduled_time_start, '09:00'::time))::timestamptz;
  ELSE
    v_scheduled := NEW.completed_at;
  END IF;

  PERFORM public.fn_upsert_canonical_appointment_from_legacy(
    'technician_assignments', NEW.id, NEW.order_id, NULL, NULL,
    NEW.service_address_id, NEW.technician_id, v_scheduled, NEW.status,
    NULL, NULL, NULL, NULL, NULL, 'installation', 'Installation', NEW.technician_notes
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_technician_assignment_to_appointment ON public.technician_assignments;
CREATE TRIGGER trg_sync_technician_assignment_to_appointment
AFTER INSERT OR UPDATE OF order_id, technician_id, scheduled_date, scheduled_time_start, status, technician_notes, service_address_id, completed_at
ON public.technician_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_technician_assignment_to_appointment();

-- Backfill canonical appointments from legacy rows currently present.
UPDATE public.installation_jobs SET updated_at = coalesce(updated_at, now()) WHERE true;
UPDATE public.installation_appointments SET updated_at = coalesce(updated_at, now()) WHERE true;
UPDATE public.installations SET updated_at = coalesce(updated_at, now()) WHERE true;
UPDATE public.technician_slot_bookings SET created_at = coalesce(created_at, now()) WHERE true;
UPDATE public.technician_assignments SET updated_at = coalesce(updated_at, now()) WHERE true;

-- Normalize all existing canonical appointment links and environment values.
UPDATE public.appointments ap
SET updated_at = now(), environment = 'live'
WHERE ap.environment IS NULL OR lower(btrim(ap.environment)) IN ('', 'production', 'prod');

UPDATE public.appointments ap
SET updated_at = now()
WHERE ap.service_address_id IS NULL
   OR ap.client_email IS NULL
   OR ap.service_address IS NULL;

CREATE OR REPLACE FUNCTION public.get_account_service_tree(_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = _account_id AND a.client_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'support')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'ops')
    OR public.has_role(auth.uid(), 'techops')
    OR public.has_role(auth.uid(), 'billing_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH acct AS (
    SELECT a.* FROM public.accounts a WHERE a.id = _account_id
  ),
  active_addresses AS (
    SELECT sa.*
    FROM public.service_addresses sa
    WHERE sa.account_id = _account_id
      AND sa.deleted_at IS NULL
  ),
  address_count AS (
    SELECT count(*)::int AS n FROM active_addresses
  ),
  account_customers AS (
    SELECT bc.id
    FROM public.billing_customers bc
    JOIN acct a ON a.client_id = bc.user_id OR lower(btrim(bc.email)) = lower(btrim(a.email))
  ),
  account_orders AS (
    SELECT o.*
    FROM public.orders o
    JOIN acct a ON (o.account_id = a.id OR o.user_id = a.client_id OR lower(btrim(o.client_email)) = lower(btrim(a.email)))
  ),
  account_subscriptions AS (
    SELECT bs.*
    FROM public.billing_subscriptions bs
    WHERE bs.customer_id IN (SELECT id FROM account_customers)
       OR bs.order_id IN (SELECT id FROM account_orders)
  ),
  account_appointments AS (
    SELECT ap.*,
      coalesce(
        ap.service_address_id,
        (SELECT o.service_address_id FROM account_orders o WHERE o.id = ap.order_id LIMIT 1),
        CASE WHEN (SELECT n FROM address_count) = 1 THEN (SELECT id FROM active_addresses LIMIT 1) ELSE NULL END
      ) AS resolved_service_address_id
    FROM public.appointments ap
    JOIN acct a ON true
    WHERE ap.client_id = a.client_id
       OR ap.order_id IN (SELECT id FROM account_orders)
       OR lower(btrim(ap.client_email)) = lower(btrim(a.email))
  ),
  address_nodes AS (
    SELECT
      sa.created_at,
      jsonb_build_object(
        'address', to_jsonb(sa.*),
        'subscriptions', COALESCE((
          SELECT jsonb_agg(to_jsonb(bs.*) ORDER BY bs.created_at DESC)
          FROM account_subscriptions bs
          WHERE bs.service_address_id = sa.id
             OR bs.address_id = sa.id
             OR EXISTS (SELECT 1 FROM account_orders o WHERE o.id = bs.order_id AND o.service_address_id = sa.id)
             OR ((SELECT n FROM address_count) = 1 AND bs.service_address_id IS NULL AND bs.address_id IS NULL)
        ), '[]'::jsonb),
        'service_instances', COALESCE((
          SELECT jsonb_agg(to_jsonb(si.*) ORDER BY si.created_at DESC)
          FROM public.service_instances si
          JOIN acct a ON true
          WHERE (si.account_id = _account_id OR si.user_id = a.client_id OR si.order_id IN (SELECT id FROM account_orders))
            AND (si.service_address_id = sa.id OR EXISTS (SELECT 1 FROM account_orders o WHERE o.id = si.order_id AND o.service_address_id = sa.id) OR ((SELECT n FROM address_count) = 1 AND si.service_address_id IS NULL))
        ), '[]'::jsonb),
        'equipment', COALESCE((
          SELECT jsonb_agg(to_jsonb(e.*) ORDER BY COALESCE(e.assigned_at, e.created_at) DESC)
          FROM public.equipment_inventory e
          WHERE (e.account_id = _account_id OR e.order_id IN (SELECT id FROM account_orders) OR e.subscription_id IN (SELECT id FROM account_subscriptions))
            AND (e.service_address_id = sa.id OR e.address_id = sa.id OR EXISTS (SELECT 1 FROM account_subscriptions bs WHERE bs.id = e.subscription_id AND (bs.service_address_id = sa.id OR bs.address_id = sa.id)) OR EXISTS (SELECT 1 FROM account_orders o WHERE o.id = e.order_id AND o.service_address_id = sa.id) OR ((SELECT n FROM address_count) = 1 AND e.service_address_id IS NULL AND e.address_id IS NULL))
        ), '[]'::jsonb),
        'appointments', COALESCE((
          SELECT jsonb_agg(to_jsonb(ap.*) ORDER BY ap.scheduled_at DESC NULLS LAST, ap.created_at DESC)
          FROM account_appointments ap
          WHERE ap.resolved_service_address_id = sa.id
             OR ((SELECT n FROM address_count) = 1 AND ap.resolved_service_address_id IS NULL)
        ), '[]'::jsonb),
        'tickets', COALESCE((
          SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.created_at DESC)
          FROM public.support_tickets t
          JOIN acct a ON true
          WHERE (t.account_id = _account_id OR t.user_id = a.client_id OR t.related_order_id IN (SELECT id FROM account_orders) OR lower(btrim(t.client_email)) = lower(btrim(a.email)))
            AND (t.service_address_id = sa.id OR EXISTS (SELECT 1 FROM account_orders o WHERE o.id = t.related_order_id AND o.service_address_id = sa.id) OR ((SELECT n FROM address_count) = 1 AND t.service_address_id IS NULL))
        ), '[]'::jsonb),
        'incidents', COALESCE((
          SELECT jsonb_agg(to_jsonb(i.*) ORDER BY COALESCE(i.started_at, i.created_at) DESC)
          FROM public.service_incidents i
          WHERE i.service_address_id = sa.id
        ), '[]'::jsonb)
      ) AS addr_obj
    FROM active_addresses sa
  )
  SELECT jsonb_build_object(
    'account_id', _account_id,
    'addresses', COALESCE(jsonb_agg(addr_obj ORDER BY created_at), '[]'::jsonb)
  ) INTO result
  FROM address_nodes;

  RETURN COALESCE(result, jsonb_build_object('account_id', _account_id, 'addresses', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_parse_legacy_slot_start(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_service_address_for_links(uuid, uuid, uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_account_service_address_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_service_tree(uuid) TO authenticated, service_role;