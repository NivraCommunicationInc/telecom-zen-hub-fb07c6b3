CREATE OR REPLACE FUNCTION public.upsert_my_technician_location(
  p_assignment_id uuid DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_accuracy_meters numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_speed_kmh numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_technician_profile_id uuid;
  v_assignment_update_count integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'missing_coordinates';
  END IF;

  SELECT t.id
    INTO v_technician_profile_id
    FROM public.technicians t
   WHERE t.user_id = v_actor OR t.id = v_actor
   ORDER BY CASE WHEN t.user_id = v_actor THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_technician_profile_id IS NULL AND NOT public.has_role(v_actor, 'technician'::public.app_role) THEN
    RAISE EXCEPTION 'technician_profile_not_found';
  END IF;

  INSERT INTO public.technician_locations (
    technician_id,
    latitude,
    longitude,
    accuracy_meters,
    heading,
    speed_kmh,
    recorded_at,
    is_active
  ) VALUES (
    v_actor,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_heading,
    p_speed_kmh,
    now(),
    true
  )
  ON CONFLICT (technician_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy_meters = EXCLUDED.accuracy_meters,
    heading = EXCLUDED.heading,
    speed_kmh = EXCLUDED.speed_kmh,
    recorded_at = now(),
    is_active = true,
    updated_at = now();

  IF p_assignment_id IS NOT NULL THEN
    UPDATE public.technician_assignments ta
       SET live_location = jsonb_build_object(
             'lat', p_latitude,
             'lng', p_longitude,
             'accuracy', p_accuracy_meters,
             'heading', p_heading,
             'speed_kmh', p_speed_kmh,
             'updated_at', now()
           ),
           updated_at = now()
     WHERE ta.id = p_assignment_id
       AND (
         ta.technician_id = v_actor
         OR ta.technician_id = v_technician_profile_id
         OR ta.technician_id IS NULL
       );

    GET DIAGNOSTICS v_assignment_update_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'technician_id', v_actor,
    'technician_profile_id', v_technician_profile_id,
    'assignment_updated', v_assignment_update_count > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_technician_location(uuid, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_technician_location(uuid, numeric, numeric, numeric, numeric, numeric) TO authenticated;