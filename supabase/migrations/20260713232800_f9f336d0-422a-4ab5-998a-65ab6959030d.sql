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
  v_actor uuid := auth.uid();
  v_technician_profile_id uuid;
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

  IF v_actor IS NOT NULL THEN
    v_technician_profile_id := public.fn_resolve_technician_profile_id(v_actor);
  END IF;

  IF v_assignment.technician_id IS NOT NULL
     AND v_actor IS NOT NULL
     AND v_assignment.technician_id <> v_actor
     AND (v_technician_profile_id IS NULL OR v_assignment.technician_id <> v_technician_profile_id)
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
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
  WHERE p.user_id = v_assignment.technician_id
     OR p.id = v_assignment.technician_id
     OR (v_actor IS NOT NULL AND p.user_id = v_actor)
     OR (v_technician_profile_id IS NOT NULL AND p.id = v_technician_profile_id)
  ORDER BY
    CASE
      WHEN p.user_id = v_assignment.technician_id THEN 1
      WHEN p.id = v_assignment.technician_id THEN 2
      WHEN v_actor IS NOT NULL AND p.user_id = v_actor THEN 3
      ELSE 4
    END
  LIMIT 1;

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