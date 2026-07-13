CREATE OR REPLACE FUNCTION public.fn_upsert_canonical_appointment_from_legacy(
  _source text,
  _source_id uuid,
  _order_id uuid DEFAULT NULL::uuid,
  _client_id uuid DEFAULT NULL::uuid,
  _account_id uuid DEFAULT NULL::uuid,
  _service_address_id uuid DEFAULT NULL::uuid,
  _technician_id uuid DEFAULT NULL::uuid,
  _scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _status text DEFAULT NULL::text,
  _service_address text DEFAULT NULL::text,
  _service_city text DEFAULT NULL::text,
  _service_postal_code text DEFAULT NULL::text,
  _client_email text DEFAULT NULL::text,
  _client_phone text DEFAULT NULL::text,
  _service_type text DEFAULT NULL::text,
  _title text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_addr uuid;
  v_order_account_id uuid;
  v_order_user_id uuid;
  v_order_client_email text;
  v_order_client_phone text;
  v_order_number text;
  v_order_addr text;
  v_order_city text;
  v_order_postal text;
  v_order_service_address_id uuid;
  v_order_service_type text;
  v_order_installation_type text;
  v_order_fulfillment_type text;
  v_order_equipment_details jsonb;
  v_status text := lower(coalesce(nullif(_status, ''), 'scheduled'));
  v_notes text;
  v_title text;
  v_effective_scheduled_at timestamptz;
BEGIN
  IF _order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, o.client_email, o.client_phone, o.order_number,
           coalesce(o.shipping_address, o.shipping_address_line, o.client_full_address),
           o.shipping_city,
           o.shipping_postal_code,
           o.service_address_id,
           o.service_type,
           o.installation_type,
           o.fulfillment_type,
           o.equipment_details
    INTO v_order_account_id, v_order_user_id, v_order_client_email, v_order_client_phone, v_order_number,
         v_order_addr, v_order_city, v_order_postal, v_order_service_address_id, v_order_service_type,
         v_order_installation_type, v_order_fulfillment_type, v_order_equipment_details
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;
  END IF;

  IF _scheduled_at IS NULL THEN
    IF _technician_id IS NULL
       AND NOT (
         _order_id IS NOT NULL
         AND (
           lower(coalesce(v_order_installation_type, '')) = 'technician'
           OR lower(coalesce(v_order_fulfillment_type, '')) = 'technician'
         )
       ) THEN
      RETURN NULL;
    END IF;

    v_effective_scheduled_at := (current_date + interval '1 day' + time '09:00')::timestamptz;
    IF v_status IN ('scheduled', 'confirmed', 'technician_assigned', 'pending', 'booked') THEN
      v_status := 'pending_scheduling';
    END IF;
  ELSE
    v_effective_scheduled_at := _scheduled_at;
  END IF;

  IF v_status IN ('pending', 'booked') THEN v_status := 'scheduled'; END IF;
  IF v_status IN ('done', 'complete') THEN v_status := 'completed'; END IF;

  IF _order_id IS NULL AND v_status IN ('confirmed', 'technician_assigned') THEN
    v_status := 'scheduled';
  END IF;

  v_addr := coalesce(
    _service_address_id,
    v_order_service_address_id,
    public.fn_resolve_service_address_for_links(
      coalesce(_account_id, v_order_account_id),
      _order_id,
      coalesce(_client_id, v_order_user_id),
      coalesce(nullif(_service_address, ''), v_order_addr),
      coalesce(nullif(_service_city, ''), v_order_city),
      coalesce(nullif(_service_postal_code, ''), v_order_postal)
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
  IF _scheduled_at IS NULL THEN
    v_notes := concat_ws(E'\n', v_notes, '[SYSTEM] Date exacte à planifier — rendez-vous placeholder créé pour visibilité Core/Portail.');
  END IF;
  v_title := coalesce(nullif(_title, ''), CASE WHEN v_order_number IS NOT NULL THEN 'Installation — ' || v_order_number ELSE 'Installation' END);

  IF v_existing IS NOT NULL THEN
    UPDATE public.appointments ap SET
      order_id = coalesce(ap.order_id, _order_id),
      client_id = coalesce(ap.client_id, _client_id, v_order_user_id),
      client_email = coalesce(nullif(ap.client_email, ''), nullif(_client_email, ''), v_order_client_email),
      client_phone = coalesce(nullif(ap.client_phone, ''), nullif(_client_phone, ''), v_order_client_phone),
      technician_id = coalesce(_technician_id, ap.technician_id),
      scheduled_at = CASE
        WHEN _scheduled_at IS NOT NULL THEN _scheduled_at
        ELSE ap.scheduled_at
      END,
      status = CASE
        WHEN _scheduled_at IS NULL AND ap.status IN ('scheduled', 'confirmed', 'technician_assigned', 'hold') THEN 'pending_scheduling'
        WHEN coalesce(ap.order_id, _order_id) IS NULL AND v_status IN ('confirmed', 'technician_assigned') THEN 'scheduled'
        ELSE coalesce(nullif(v_status, ''), ap.status, 'scheduled')
      END,
      service_type = coalesce(nullif(_service_type, ''), ap.service_type, v_order_service_type, 'installation'),
      installation_method = coalesce(ap.installation_method, 'technician'),
      service_address_id = coalesce(ap.service_address_id, v_addr, v_order_service_address_id),
      service_address = coalesce(nullif(ap.service_address, ''), nullif(_service_address, ''), v_order_addr),
      service_city = coalesce(nullif(ap.service_city, ''), nullif(_service_city, ''), v_order_city),
      service_postal_code = coalesce(nullif(ap.service_postal_code, ''), nullif(_service_postal_code, ''), v_order_postal),
      equipment_details = CASE
        WHEN coalesce(ap.equipment_details, '[]'::jsonb) = '[]'::jsonb THEN coalesce(v_order_equipment_details, ap.equipment_details, '[]'::jsonb)
        ELSE ap.equipment_details
      END,
      internal_notes = CASE
        WHEN ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%') THEN ap.internal_notes
        ELSE concat_ws(E'\n', ap.internal_notes, v_notes)
      END,
      updated_at = now()
    WHERE ap.id = v_existing
    RETURNING ap.id INTO v_existing;
    RETURN v_existing;
  END IF;

  INSERT INTO public.appointments (
    order_id, client_id, client_email, client_phone, technician_id,
    title, scheduled_at, status, service_type, installation_method,
    service_address_id, service_address, service_city, service_postal_code,
    equipment_details, internal_notes, environment, updated_at
  ) VALUES (
    _order_id,
    coalesce(_client_id, v_order_user_id),
    coalesce(nullif(_client_email, ''), v_order_client_email),
    coalesce(nullif(_client_phone, ''), v_order_client_phone),
    _technician_id,
    v_title,
    v_effective_scheduled_at,
    v_status,
    coalesce(nullif(_service_type, ''), v_order_service_type, 'installation'),
    'technician',
    coalesce(v_addr, v_order_service_address_id),
    coalesce(nullif(_service_address, ''), v_order_addr),
    coalesce(nullif(_service_city, ''), v_order_city),
    coalesce(nullif(_service_postal_code, ''), v_order_postal),
    coalesce(v_order_equipment_details, '[]'::jsonb),
    v_notes,
    'live',
    now()
  )
  RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_order_installation_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _appt_id uuid;
  _start_time text;
  _scheduled_at timestamptz;
  _legacy_source_id uuid;
BEGIN
  IF lower(coalesce(NEW.installation_type, '')) = 'auto'
     OR lower(coalesce(NEW.fulfillment_type, '')) = 'self_install' THEN
    UPDATE public.appointments
       SET status = 'cancelled',
           installation_method = 'auto',
           cancellation_reason = coalesce(cancellation_reason, 'Commande basculée en auto-installation'),
           updated_at = now()
     WHERE order_id = NEW.id
       AND coalesce(status, '') NOT IN ('cancelled', 'completed');
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.installation_type, '')) <> 'technician'
     AND lower(coalesce(NEW.fulfillment_type, '')) <> 'technician' THEN
    RETURN NEW;
  END IF;

  _scheduled_at := NEW.appointment_date;
  IF NEW.appointment_date IS NOT NULL
     AND coalesce(NEW.appointment_notes, '') ~ '^\d{2}:\d{2}-\d{2}:\d{2}$' THEN
    _start_time := split_part(NEW.appointment_notes, '-', 1);
    _scheduled_at := ((NEW.appointment_date::date::text || ' ' || _start_time || ':00')::timestamp AT TIME ZONE 'America/Toronto');
  END IF;

  SELECT fso.id INTO _legacy_source_id
  FROM public.field_sales_orders fso
  WHERE fso.converted_order_id = NEW.id
  ORDER BY fso.updated_at DESC NULLS LAST, fso.created_at DESC NULLS LAST
  LIMIT 1;

  IF _scheduled_at IS NULL AND _legacy_source_id IS NOT NULL THEN
    SELECT CASE
             WHEN fso.appointment_date IS NOT NULL THEN fso.appointment_date
             WHEN fso.install_date IS NOT NULL THEN (fso.install_date::date::text || ' 09:00:00')::timestamp AT TIME ZONE 'America/Toronto'
             ELSE NULL
           END
    INTO _scheduled_at
    FROM public.field_sales_orders fso
    WHERE fso.id = _legacy_source_id;
  END IF;

  _appt_id := public.fn_upsert_canonical_appointment_from_legacy(
    'orders',
    coalesce(_legacy_source_id, NEW.id),
    NEW.id,
    NEW.user_id,
    NEW.account_id,
    NEW.service_address_id,
    NEW.technician_id,
    _scheduled_at,
    CASE WHEN _scheduled_at IS NULL THEN 'pending_scheduling' ELSE 'hold' END,
    coalesce(NEW.shipping_address, NEW.client_full_address),
    NEW.shipping_city,
    NEW.shipping_postal_code,
    NEW.client_email,
    NEW.client_phone,
    NEW.service_type,
    'Installation — ' || coalesce(NEW.order_number, NEW.id::text),
    concat_ws(E'\n', '[SYSTEM] Rendez-vous technicien synchronisé depuis la commande', NEW.appointment_notes)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_order_installation_appointment ON public.orders;
CREATE TRIGGER trg_sync_order_installation_appointment
AFTER INSERT OR UPDATE OF fulfillment_type, installation_type, appointment_date, appointment_notes, service_address_id, shipping_address, shipping_city, shipping_postal_code, equipment_details, technician_id, user_id, client_email, client_phone
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_order_installation_appointment();

WITH missing AS (
  SELECT o.id
  FROM public.orders o
  WHERE (lower(coalesce(o.installation_type, '')) = 'technician' OR lower(coalesce(o.fulfillment_type, '')) = 'technician')
    AND coalesce(o.status, '') NOT IN ('cancelled', 'refunded', 'deleted')
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments ap
      WHERE ap.order_id = o.id
        AND coalesce(ap.status, '') <> 'cancelled'
    )
)
UPDATE public.orders o
SET updated_at = now()
FROM missing m
WHERE o.id = m.id;