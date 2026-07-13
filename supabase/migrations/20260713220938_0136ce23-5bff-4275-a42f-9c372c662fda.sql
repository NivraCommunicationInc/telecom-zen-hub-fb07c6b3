CREATE OR REPLACE FUNCTION public.fn_resolve_technician_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT t.id INTO v_profile_id
  FROM public.technicians t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN v_profile_id;
  END IF;

  SELECT
    COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.full_name, p.email, 'Technicien'),
    NULLIF(trim(p.email), '')
  INTO v_name, v_email
  FROM public.profiles p
  WHERE p.user_id = _user_id OR p.id = _user_id
  ORDER BY p.created_at DESC NULLS LAST
  LIMIT 1;

  v_email := COALESCE(v_email, 'tech-' || _user_id::text || '@nivra.local');

  SELECT t.id INTO v_profile_id
  FROM public.technicians t
  WHERE lower(coalesce(t.email, '')) = lower(v_email)
     OR lower(coalesce(t.full_name, '')) = lower(coalesce(v_name, ''))
  ORDER BY t.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.technicians
       SET user_id = COALESCE(user_id, _user_id),
           email = COALESCE(NULLIF(email, ''), v_email),
           updated_at = now()
     WHERE id = v_profile_id;
    RETURN v_profile_id;
  END IF;

  INSERT INTO public.technicians(user_id, full_name, email, status)
  VALUES (_user_id, COALESCE(v_name, 'Technicien'), v_email, 'active')
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_technician_profile_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_resolve_technician_profile_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_technician_profile_id(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tech_update_assignment_status(
  p_assignment_id uuid,
  p_status text,
  p_note text DEFAULT NULL::text,
  p_eta text DEFAULT NULL::text,
  p_wifi_ssid text DEFAULT NULL::text,
  p_wifi_password text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assignment public.technician_assignments%ROWTYPE;
  v_appt_id uuid;
  v_appt_status text;
  v_notes text;
  v_actor uuid := auth.uid();
  v_technician_profile_id uuid;
  v_extra jsonb := '{}'::jsonb;
  v_template text;
  v_network jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'technician'::app_role)
    OR public.has_role(v_actor, 'admin'::app_role)
    OR public.has_role(v_actor, 'employee'::app_role)
    OR public.has_role(v_actor, 'supervisor'::app_role)
    OR public.has_role(v_actor, 'techops'::app_role)
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_status NOT IN ('accepted','scheduled','en_route','arrived','in_progress','completed','missed','rescheduled','cancelled') THEN
    RAISE EXCEPTION 'Statut technicien invalide: %', p_status;
  END IF;

  SELECT * INTO v_assignment FROM public.technician_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;

  IF v_assignment.technician_id IS NOT NULL
     AND v_assignment.technician_id <> v_actor
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
     ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas assigné à cette mission';
  END IF;

  v_technician_profile_id := public.fn_resolve_technician_profile_id(v_actor);
  v_notes := NULLIF(trim(coalesce(p_note, '')), '');
  v_network := COALESCE(v_assignment.network_test_results, '{}'::jsonb);

  IF NULLIF(trim(coalesce(p_wifi_ssid, '')), '') IS NOT NULL THEN
    v_network := v_network || jsonb_build_object('wifi_ssid', trim(p_wifi_ssid));
  END IF;
  IF NULLIF(trim(coalesce(p_wifi_password, '')), '') IS NOT NULL THEN
    v_network := v_network || jsonb_build_object('wifi_password', trim(p_wifi_password));
  END IF;

  UPDATE public.technician_assignments
  SET
    status = p_status,
    technician_id = COALESCE(technician_id, v_actor),
    missed_at = CASE WHEN p_status = 'missed' THEN now() ELSE missed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    client_notified_en_route = CASE WHEN p_status = 'en_route' THEN true ELSE client_notified_en_route END,
    client_notified_missed = CASE WHEN p_status = 'missed' THEN true ELSE client_notified_missed END,
    network_test_results = v_network,
    technician_notes = CASE
      WHEN v_notes IS NULL THEN technician_notes
      WHEN technician_notes IS NULL OR technician_notes = '' THEN v_notes
      ELSE technician_notes || E'\n' || v_notes
    END,
    updated_at = now()
  WHERE id = p_assignment_id;

  SELECT * INTO v_assignment FROM public.technician_assignments WHERE id = p_assignment_id;

  IF v_assignment.order_id IS NOT NULL THEN
    SELECT id INTO v_appt_id
    FROM public.appointments
    WHERE order_id = v_assignment.order_id
    ORDER BY scheduled_at DESC NULLS LAST
    LIMIT 1;

    IF v_appt_id IS NOT NULL THEN
      v_appt_status := CASE p_status
        WHEN 'accepted' THEN 'confirmed'
        WHEN 'missed' THEN 'no_show'
        ELSE p_status
      END;

      UPDATE public.appointments
      SET
        status = v_appt_status,
        technician_id = COALESCE(v_technician_profile_id, technician_id),
        updated_at = now(),
        updated_by = v_actor,
        internal_notes = CASE
          WHEN v_notes IS NULL AND NULLIF(trim(coalesce(p_eta, '')), '') IS NULL THEN internal_notes
          ELSE concat_ws(E'\n',
            NULLIF(internal_notes, ''),
            concat('[Technicien ', to_char(now(), 'YYYY-MM-DD HH24:MI'), '] ',
              CASE p_status
                WHEN 'accepted' THEN 'Mission acceptée'
                WHEN 'en_route' THEN 'En route'
                WHEN 'arrived' THEN 'Arrivé sur place'
                WHEN 'in_progress' THEN 'Installation démarrée'
                WHEN 'completed' THEN 'Installation complétée'
                WHEN 'missed' THEN 'Client absent / rendez-vous manqué'
                WHEN 'cancelled' THEN 'Rendez-vous annulé'
                WHEN 'rescheduled' THEN 'À replanifier'
                ELSE 'Statut mis à jour'
              END,
              CASE WHEN NULLIF(trim(coalesce(p_eta, '')), '') IS NOT NULL THEN ' · ETA: ' || trim(p_eta) ELSE '' END,
              CASE WHEN v_notes IS NOT NULL THEN ' · Note: ' || v_notes ELSE '' END
            )
          )
        END
      WHERE id = v_appt_id;
    END IF;
  END IF;

  v_template := CASE p_status
    WHEN 'en_route' THEN 'tech_en_route'
    WHEN 'in_progress' THEN 'tech_in_progress'
    WHEN 'completed' THEN 'tech_completed'
    WHEN 'missed' THEN 'tech_missed'
    WHEN 'rescheduled' THEN 'tech_rescheduled'
    ELSE NULL
  END;

  IF v_template IS NOT NULL THEN
    v_extra := CASE p_status
      WHEN 'en_route' THEN jsonb_build_object('eta', COALESCE(NULLIF(trim(coalesce(p_eta, '')), ''), 'sous peu'))
      WHEN 'in_progress' THEN jsonb_build_object('start_time', to_char(now() AT TIME ZONE 'America/Toronto', 'HH24:MI'))
      WHEN 'completed' THEN jsonb_build_object(
        'speed', COALESCE(v_assignment.download_speed::text || ' Mbps', 'Optimale'),
        'wifi_ssid', COALESCE(NULLIF(trim(coalesce(p_wifi_ssid, '')), ''), v_assignment.network_test_results->>'wifi_ssid'),
        'wifi_password', COALESCE(NULLIF(trim(coalesce(p_wifi_password, '')), ''), v_assignment.network_test_results->>'wifi_password')
      )
      WHEN 'missed' THEN jsonb_build_object('reason', COALESCE(v_notes, 'Client absent / rendez-vous manqué'))
      ELSE '{}'::jsonb
    END;

    PERFORM public.queue_tech_status_email(p_assignment_id, v_template, v_extra);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_my_technician_location(
  p_assignment_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision DEFAULT NULL::double precision,
  p_heading double precision DEFAULT NULL::double precision,
  p_speed_kmh double precision DEFAULT NULL::double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tech_id uuid;
  v_assignment public.technician_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'technician'::app_role)
    OR public.has_role(v_actor, 'admin'::app_role)
    OR public.has_role(v_actor, 'employee'::app_role)
    OR public.has_role(v_actor, 'supervisor'::app_role)
    OR public.has_role(v_actor, 'techops'::app_role)
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  v_tech_id := public.fn_resolve_technician_profile_id(v_actor);

  SELECT * INTO v_assignment
  FROM public.technician_assignments
  WHERE id = p_assignment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  IF v_assignment.technician_id IS NULL THEN
    UPDATE public.technician_assignments
       SET technician_id = v_actor,
           updated_at = now()
     WHERE id = p_assignment_id;
  ELSIF v_assignment.technician_id <> v_actor
        AND NOT (
          public.has_role(v_actor, 'admin'::app_role)
          OR public.has_role(v_actor, 'employee'::app_role)
          OR public.has_role(v_actor, 'supervisor'::app_role)
          OR public.has_role(v_actor, 'techops'::app_role)
        ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  INSERT INTO public.technician_locations(
    technician_id, installation_job_id, latitude, longitude, accuracy_meters, heading, speed_kmh, is_active, recorded_at, updated_at
  ) VALUES (
    v_tech_id, null, p_latitude, p_longitude, p_accuracy_meters, p_heading, p_speed_kmh, true, now(), now()
  )
  ON CONFLICT (technician_id) DO UPDATE
    SET latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters,
        heading = excluded.heading,
        speed_kmh = excluded.speed_kmh,
        is_active = true,
        recorded_at = now(),
        updated_at = now();

  UPDATE public.technician_assignments
     SET live_location = jsonb_build_object(
          'lat', p_latitude,
          'lng', p_longitude,
          'accuracy', p_accuracy_meters,
          'heading', p_heading,
          'speed_kmh', p_speed_kmh,
          'updated_at', now()
        ),
        updated_at = now()
   WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'technician_id', v_tech_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_technician_location(uuid, double precision, double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_technician_location(uuid, double precision, double precision, double precision, double precision, double precision) TO authenticated;