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
           coalesce(o.service_address, o.shipping_address, o.client_full_address),
           coalesce(o.service_city, o.shipping_city),
           coalesce(o.service_postal_code, o.shipping_postal_code),
           o.service_address_id,
           o.service_type
    INTO v_order_account_id, v_order_user_id, v_order_client_email, v_order_client_phone, v_order_number,
         v_order_addr, v_order_city, v_order_postal, v_order_service_address_id, v_order_service_type
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;
  END IF;

  v_addr := coalesce(
    _service_address_id,
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
  v_title := coalesce(nullif(_title, ''), CASE WHEN v_order_number IS NOT NULL THEN 'Installation — ' || v_order_number ELSE 'Installation' END);

  IF v_existing IS NOT NULL THEN
    UPDATE public.appointments ap SET
      order_id = coalesce(ap.order_id, _order_id),
      client_id = coalesce(ap.client_id, _client_id, v_order_user_id),
      client_email = coalesce(nullif(ap.client_email, ''), nullif(_client_email, ''), v_order_client_email),
      client_phone = coalesce(nullif(ap.client_phone, ''), nullif(_client_phone, ''), v_order_client_phone),
      technician_id = coalesce(_technician_id, ap.technician_id),
      scheduled_at = coalesce(_scheduled_at, ap.scheduled_at),
      status = coalesce(nullif(v_status, ''), ap.status, 'scheduled'),
      service_type = coalesce(nullif(_service_type, ''), ap.service_type, v_order_service_type, 'installation'),
      installation_method = coalesce(ap.installation_method, 'technician'),
      service_address_id = coalesce(ap.service_address_id, v_addr, v_order_service_address_id),
      service_address = coalesce(nullif(ap.service_address, ''), nullif(_service_address, ''), v_order_addr),
      service_city = coalesce(nullif(ap.service_city, ''), nullif(_service_city, ''), v_order_city),
      service_postal_code = coalesce(nullif(ap.service_postal_code, ''), nullif(_service_postal_code, ''), v_order_postal),
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
    coalesce(_client_id, v_order_user_id),
    coalesce(nullif(_client_email, ''), v_order_client_email),
    coalesce(nullif(_client_phone, ''), v_order_client_phone),
    _technician_id,
    _scheduled_at,
    coalesce(nullif(v_status, ''), 'scheduled'),
    coalesce(nullif(_service_type, ''), v_order_service_type, 'installation'),
    'technician',
    coalesce(v_addr, v_order_service_address_id),
    coalesce(nullif(_service_address, ''), v_order_addr),
    coalesce(nullif(_service_city, ''), v_order_city),
    coalesce(nullif(_service_postal_code, ''), v_order_postal),
    v_title,
    v_notes,
    'live'
  ) RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$$;