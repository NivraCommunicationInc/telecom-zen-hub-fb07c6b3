
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
  v_order_id uuid;
  v_tech_id uuid;
  v_client_email text;
  v_client_first text;
  v_order_number text;
  v_scheduled_date date;
  v_tech_first text;
  v_tech_last text;
  v_tech_name text := 'Votre technicien Nivra';
  v_email_id uuid;
  v_event_key text;
  v_vars jsonb;
BEGIN
  IF p_template_key NOT IN (
    'tech_en_route','tech_arrived','tech_in_progress',
    'tech_completed','tech_missed','tech_rescheduled'
  ) THEN
    RAISE EXCEPTION 'invalid template_key: %', p_template_key;
  END IF;

  SELECT ta.order_id, ta.technician_id, ta.scheduled_date
    INTO v_order_id, v_tech_id, v_scheduled_date
  FROM technician_assignments ta
  WHERE ta.id = p_assignment_id;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Authorize: must be the assigned tech OR an admin/employee role
  IF v_tech_id <> auth.uid()
     AND NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'employee'::app_role)
       OR public.has_role(auth.uid(), 'supervisor'::app_role)
       OR public.has_role(auth.uid(), 'techops'::app_role)
     )
  THEN
    RAISE EXCEPTION 'not authorized for this assignment';
  END IF;

  SELECT o.client_email, o.client_first_name, o.order_number
    INTO v_client_email, v_client_first, v_order_number
  FROM orders o WHERE o.id = v_order_id;

  IF v_client_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.first_name, p.last_name INTO v_tech_first, v_tech_last
  FROM profiles p WHERE p.user_id = v_tech_id;

  IF coalesce(v_tech_first,'') <> '' OR coalesce(v_tech_last,'') <> '' THEN
    v_tech_name := trim(both ' ' from coalesce(v_tech_first,'') || ' ' || coalesce(v_tech_last,''));
  END IF;

  v_vars := jsonb_build_object(
    'first_name', coalesce(v_client_first, 'Client'),
    'tech_name', v_tech_name,
    'order_number', v_order_number,
    'scheduled_date', v_scheduled_date,
    'bcc', 'support@nivra-telecom.ca'
  ) || coalesce(p_extra, '{}'::jsonb);

  v_event_key := p_template_key || ':' || p_assignment_id::text || ':' || extract(epoch from now())::bigint::text;

  INSERT INTO email_queue (event_key, to_email, template_key, template_vars, status, language)
  VALUES (v_event_key, v_client_email, p_template_key, v_vars, 'queued', 'fr')
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_tech_status_email(uuid, text, jsonb) TO authenticated;
