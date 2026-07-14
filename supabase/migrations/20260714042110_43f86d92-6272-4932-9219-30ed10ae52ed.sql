
ALTER TABLE public.technician_assignments
  ADD COLUMN IF NOT EXISTS sequence_order integer,
  ADD COLUMN IF NOT EXISTS route_optimized_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tech_assign_tech_date_seq
  ON public.technician_assignments (technician_id, scheduled_date, sequence_order);

CREATE OR REPLACE FUNCTION public.fn_reorder_assignments(
  _tech_id uuid,
  _ordered_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE i int;
BEGIN
  IF _tech_id IS NULL OR _tech_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  FOR i IN 1..array_length(_ordered_ids, 1) LOOP
    UPDATE public.technician_assignments
       SET sequence_order = i, updated_at = now()
     WHERE id = _ordered_ids[i] AND technician_id = _tech_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_optimize_route(
  _tech_id uuid, _date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  start_lat numeric; start_lng numeric;
  pts jsonb; ordered uuid[] := ARRAY[]::uuid[];
  remaining jsonb; cur_lat numeric; cur_lng numeric;
  best jsonb; best_d numeric; d numeric; it jsonb;
  total_km numeric := 0; i int := 0;
BEGIN
  IF _tech_id IS NULL OR _tech_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT latitude, longitude INTO start_lat, start_lng
    FROM public.technician_locations
   WHERE technician_id = _tech_id AND is_active = true
   ORDER BY recorded_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'lat', sa.latitude, 'lng', sa.longitude)), '[]'::jsonb)
    INTO pts
    FROM public.technician_assignments a
    LEFT JOIN public.service_addresses sa ON sa.id = a.service_address_id
   WHERE a.technician_id = _tech_id
     AND a.scheduled_date = _date
     AND a.status NOT IN ('completed','cancelled','missed')
     AND sa.latitude IS NOT NULL AND sa.longitude IS NOT NULL;

  IF jsonb_array_length(pts) = 0 THEN
    RETURN jsonb_build_object('ordered_ids','[]'::jsonb,'total_km',0,'count',0);
  END IF;

  remaining := pts;
  cur_lat := COALESCE(start_lat, (remaining->0->>'lat')::numeric);
  cur_lng := COALESCE(start_lng, (remaining->0->>'lng')::numeric);

  WHILE jsonb_array_length(remaining) > 0 LOOP
    best := NULL; best_d := NULL;
    FOR it IN SELECT * FROM jsonb_array_elements(remaining) LOOP
      d := ((( (it->>'lat')::numeric - cur_lat) * 111.0) ^ 2 +
            (( (it->>'lng')::numeric - cur_lng) * 111.0 * cos(radians(cur_lat))) ^ 2);
      IF best_d IS NULL OR d < best_d THEN best_d := d; best := it; END IF;
    END LOOP;
    ordered := ordered || (best->>'id')::uuid;
    total_km := total_km + sqrt(best_d);
    cur_lat := (best->>'lat')::numeric;
    cur_lng := (best->>'lng')::numeric;
    remaining := (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
        FROM jsonb_array_elements(remaining) x
       WHERE x->>'id' <> best->>'id'
    );
    i := i + 1;
    EXIT WHEN i > 50;
  END LOOP;

  FOR i IN 1..array_length(ordered,1) LOOP
    UPDATE public.technician_assignments
       SET sequence_order = i, route_optimized_at = now(), updated_at = now()
     WHERE id = ordered[i] AND technician_id = _tech_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ordered_ids', to_jsonb(ordered),
    'total_km', round(total_km::numeric, 2),
    'count', array_length(ordered,1)
  );
END $$;

CREATE OR REPLACE FUNCTION public.fn_upsert_technician_location(
  _lat numeric, _lng numeric,
  _accuracy numeric DEFAULT NULL,
  _speed numeric DEFAULT NULL,
  _heading numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.technician_locations
    (technician_id, latitude, longitude, accuracy_meters, speed_kmh, heading, recorded_at, is_active)
  VALUES (auth.uid(), _lat, _lng, _accuracy, _speed, _heading, now(), true)
  ON CONFLICT (technician_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        accuracy_meters = EXCLUDED.accuracy_meters,
        speed_kmh = EXCLUDED.speed_kmh, heading = EXCLUDED.heading,
        recorded_at = now(), is_active = true, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.fn_get_my_day(_date date DEFAULT current_date)
RETURNS TABLE (
  assignment_id uuid, order_id uuid,
  scheduled_date date, time_start time, time_end time,
  status text, sequence_order int,
  service_address_id uuid, address_line text, city text, postal_code text,
  latitude numeric, longitude numeric,
  client_full_name text, client_phone text, client_email text,
  service_type text,
  intervention_session_id uuid, intervention_step text,
  intervention_progress int, intervention_status text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id, a.order_id,
    a.scheduled_date, a.scheduled_time_start, a.scheduled_time_end,
    a.status, a.sequence_order,
    a.service_address_id, sa.address_line, sa.city, sa.postal_code,
    sa.latitude, sa.longitude,
    trim(BOTH ' ' FROM COALESCE(o.client_first_name,'') || ' ' || COALESCE(o.client_last_name,'')) AS client_full_name,
    o.client_phone, o.client_email,
    ap.service_type,
    isess.id, isess.current_step::text, isess.progress, isess.status::text
  FROM public.technician_assignments a
  LEFT JOIN public.service_addresses sa ON sa.id = a.service_address_id
  LEFT JOIN public.orders o ON o.id = a.order_id
  LEFT JOIN public.appointments ap ON ap.order_id = a.order_id
  LEFT JOIN LATERAL (
    SELECT id, current_step, progress, status
      FROM public.intervention_sessions
     WHERE assignment_id = a.id
     ORDER BY started_at DESC LIMIT 1
  ) isess ON true
  WHERE a.technician_id = auth.uid()
    AND a.scheduled_date = _date
  ORDER BY COALESCE(a.sequence_order, 999), a.scheduled_time_start;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reorder_assignments(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_optimize_route(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_technician_location(numeric, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_my_day(date) TO authenticated;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_assignments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.service_incidents; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
