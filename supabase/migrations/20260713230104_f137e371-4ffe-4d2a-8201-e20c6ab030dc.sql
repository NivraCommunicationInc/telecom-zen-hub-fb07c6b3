CREATE OR REPLACE FUNCTION public.queue_tech_status_email(
  p_assignment_id uuid,
  p_template_key text,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.technician_assignments%ROWTYPE;
  v_order record;
  v_appointment record;
  v_client_email text;
  v_client_first text;
  v_tech_first text;
  v_tech_last text;
  v_tech_name text := 'Votre technicien Nivra';
  v_email_id uuid;
  v_event_key text;
  v_vars jsonb;
BEGIN
  IF p_template_key NOT IN (
    'tech_accepted','tech_en_route','tech_arrived','tech_in_progress',
    'tech_completed','tech_missed','tech_rescheduled'
  ) THEN
    RAISE EXCEPTION 'invalid template_key: %', p_template_key;
  END IF;

  SELECT * INTO v_assignment
  FROM public.technician_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND OR v_assignment.order_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_assignment.technician_id IS NOT NULL
     AND v_assignment.technician_id <> auth.uid()
     AND NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'employee'::app_role)
       OR public.has_role(auth.uid(), 'supervisor'::app_role)
       OR public.has_role(auth.uid(), 'techops'::app_role)
     )
  THEN
    RAISE EXCEPTION 'not authorized for this assignment';
  END IF;

  SELECT o.id, o.client_email, o.client_first_name, o.order_number, o.client_full_address
    INTO v_order
  FROM public.orders o
  WHERE o.id = v_assignment.order_id;

  SELECT a.id, a.client_email, a.service_address, a.service_city, a.service_postal_code, a.appointment_number
    INTO v_appointment
  FROM public.appointments a
  WHERE a.order_id = v_assignment.order_id
  ORDER BY a.scheduled_at DESC NULLS LAST
  LIMIT 1;

  v_client_email := COALESCE(v_appointment.client_email, v_order.client_email);
  v_client_first := COALESCE(v_order.client_first_name, 'Client');

  IF v_client_email IS NULL OR trim(v_client_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT p.first_name, p.last_name INTO v_tech_first, v_tech_last
  FROM public.profiles p
  WHERE p.user_id = v_assignment.technician_id;

  IF coalesce(v_tech_first,'') <> '' OR coalesce(v_tech_last,'') <> '' THEN
    v_tech_name := trim(both ' ' from coalesce(v_tech_first,'') || ' ' || coalesce(v_tech_last,''));
  END IF;

  v_vars := jsonb_build_object(
    'first_name', COALESCE(v_client_first, 'Client'),
    'tech_name', v_tech_name,
    'order_number', COALESCE(v_order.order_number, v_assignment.order_id::text),
    'appointment_number', v_appointment.appointment_number,
    'scheduled_date', v_assignment.scheduled_date,
    'scheduled_time', to_char(v_assignment.scheduled_time_start, 'HH24:MI'),
    'service_address', COALESCE(
      concat_ws(', ', NULLIF(v_appointment.service_address, ''), NULLIF(v_appointment.service_city, ''), NULLIF(v_appointment.service_postal_code, '')),
      v_order.client_full_address
    ),
    'bcc', 'support@nivra-telecom.ca'
  ) || coalesce(p_extra, '{}'::jsonb);

  v_event_key := p_template_key || ':' || p_assignment_id::text;

  INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status, language)
  VALUES (v_event_key, v_client_email, p_template_key, v_vars, 'queued', 'fr')
  ON CONFLICT (event_key) DO UPDATE
    SET template_vars = EXCLUDED.template_vars,
        status = 'queued',
        next_retry_at = NULL,
        last_error = NULL
    WHERE public.email_queue.status <> 'sent'
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_tech_status_email(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_tech_status_email(uuid, text, jsonb) TO authenticated;

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
  v_now_time text := to_char(now(), 'HH24:MI');
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

  v_technician_profile_id := public.fn_resolve_technician_profile_id(v_actor);

  SELECT * INTO v_assignment
  FROM public.technician_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  IF v_assignment.technician_id IS NOT NULL
     AND v_assignment.technician_id <> v_actor
     AND v_assignment.technician_id <> v_technician_profile_id
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
     ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas assigné à cette mission';
  END IF;

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
    technician_id = v_actor,
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
        technician_id = v_technician_profile_id,
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
    WHEN 'accepted' THEN 'tech_accepted'
    WHEN 'en_route' THEN 'tech_en_route'
    WHEN 'arrived' THEN 'tech_arrived'
    WHEN 'in_progress' THEN 'tech_in_progress'
    WHEN 'completed' THEN 'tech_completed'
    WHEN 'missed' THEN 'tech_missed'
    WHEN 'rescheduled' THEN 'tech_rescheduled'
    ELSE NULL
  END;

  IF v_template IS NOT NULL THEN
    v_extra := CASE p_status
      WHEN 'accepted' THEN jsonb_build_object('accepted_time', v_now_time)
      WHEN 'en_route' THEN jsonb_build_object('eta', COALESCE(NULLIF(trim(coalesce(p_eta, '')), ''), 'sous peu'))
      WHEN 'arrived' THEN jsonb_build_object('arrival_time', v_now_time)
      WHEN 'in_progress' THEN jsonb_build_object('start_time', v_now_time)
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