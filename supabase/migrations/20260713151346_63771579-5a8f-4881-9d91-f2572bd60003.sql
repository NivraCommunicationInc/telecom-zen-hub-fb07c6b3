CREATE OR REPLACE FUNCTION public.fn_nivra_fmt_install_date(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN ''
    ELSE trim(to_char(p_ts AT TIME ZONE 'America/Toronto', 'FMDD TMMonth YYYY'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nivra_fmt_install_time(p_ts timestamptz, p_duration integer DEFAULT 120)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_start text;
  v_end text;
BEGIN
  IF p_ts IS NULL THEN
    RETURN '';
  END IF;

  v_start := to_char(p_ts AT TIME ZONE 'America/Toronto', 'HH24:MI');
  v_end := to_char((p_ts + make_interval(mins => GREATEST(COALESCE(p_duration, 120), 30))) AT TIME ZONE 'America/Toronto', 'HH24:MI');
  RETURN v_start || ' - ' || v_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nivra_order_client_email(p_order_id uuid, p_fallback_email text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT COALESCE(
    NULLIF(o.client_email, ''),
    NULLIF(p.email, ''),
    NULLIF(p_fallback_email, '')
  )
  INTO v_email
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE o.id = p_order_id;

  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nivra_order_client_name(p_order_id uuid, p_client_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(
    NULLIF(trim(concat_ws(' ', o.client_first_name, o.client_last_name)), ''),
    NULLIF(p.full_name, ''),
    'Client'
  )
  INTO v_name
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id OR (p_client_id IS NOT NULL AND p.user_id = p_client_id)
  WHERE o.id = p_order_id
  LIMIT 1;

  RETURN COALESCE(v_name, 'Client');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nivra_order_number(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_order_number text;
BEGIN
  SELECT COALESCE(NULLIF(o.confirmation_number, ''), o.order_number::text, o.id::text)
  INTO v_order_number
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN v_order_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_nivra_appointment_address(p_appointment public.appointments)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_address text;
BEGIN
  v_address := NULLIF(trim(concat_ws(', ', NULLIF(p_appointment.service_address, ''), NULLIF(p_appointment.service_city, ''), NULLIF(p_appointment.service_postal_code, ''))), '');
  RETURN COALESCE(v_address, NULLIF(p_appointment.service_address, ''), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_enqueue_core_installation_emails(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_order_address text;
  v_email text;
  v_client_name text;
  v_order_number text;
  v_technician_name text;
  v_address text;
  v_date text;
  v_time text;
  v_reminder_at timestamptz;
  v_confirm_result jsonb;
  v_reminder_result jsonb;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'appointment_not_found');
  END IF;

  IF v_appt.status IS DISTINCT FROM 'confirmed' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'appointment_not_confirmed');
  END IF;

  IF v_appt.order_id IS NULL THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'missing_order');
  END IF;

  IF v_appt.technician_id IS NULL THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'missing_technician');
  END IF;

  IF v_appt.scheduled_at IS NULL THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'missing_scheduled_at');
  END IF;

  SELECT o.client_full_address INTO v_order_address
  FROM public.orders o
  WHERE o.id = v_appt.order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'order_not_found');
  END IF;

  v_email := public.fn_nivra_order_client_email(v_appt.order_id, v_appt.client_email);
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'missing_client_email');
  END IF;

  SELECT full_name INTO v_technician_name
  FROM public.technicians
  WHERE id = v_appt.technician_id;

  IF v_technician_name IS NULL OR v_technician_name = '' THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'missing_technician_name');
  END IF;

  v_client_name := public.fn_nivra_order_client_name(v_appt.order_id, v_appt.client_id);
  v_order_number := public.fn_nivra_order_number(v_appt.order_id);
  v_address := COALESCE(NULLIF(public.fn_nivra_appointment_address(v_appt), ''), NULLIF(v_order_address, ''), '');
  v_date := public.fn_nivra_fmt_install_date(v_appt.scheduled_at);
  v_time := public.fn_nivra_fmt_install_time(v_appt.scheduled_at, v_appt.duration_minutes);
  v_reminder_at := v_appt.scheduled_at - interval '1 hour';

  v_confirm_result := public.rpc_communication_enqueue(
    p_channel => 'email',
    p_template_key => 'appointment_scheduled',
    p_recipient => v_email,
    p_template_vars => jsonb_build_object(
      'client_name', v_client_name,
      'CLIENT_FIRST_NAME', split_part(v_client_name, ' ', 1),
      'CLIENT_FULL_NAME', v_client_name,
      'order_number', v_order_number,
      'ORDER_NUMBER', v_order_number,
      'appointment_id', v_appt.id,
      'appointment_number', COALESCE(v_appt.appointment_number, ''),
      'appointment_date', v_date,
      'APPOINTMENT_DATE', v_date,
      'appointment_time', v_time,
      'APPOINTMENT_TIME', v_time,
      'appointment_type', 'Installation',
      'APPOINTMENT_TYPE', 'Installation',
      'appointment_address_line1', v_address,
      'APPOINTMENT_ADDRESS_LINE1', v_address,
      'service_address', v_address,
      'technician_name', v_technician_name,
      'TECHNICIAN_NAME', v_technician_name,
      'scheduled_at', v_appt.scheduled_at
    ),
    p_idempotency_key => 'core_installation_confirmed:' || v_appt.id::text,
    p_category => 'transactional',
    p_entity_type => 'order',
    p_entity_id => v_appt.order_id::text,
    p_reason => 'Core appointment confirmed with technician assigned',
    p_subject => 'Rendez-vous d''installation confirmé — Nivra'
  );

  IF v_reminder_at > now() THEN
    v_reminder_result := public.rpc_communication_enqueue(
      p_channel => 'email',
      p_template_key => 'technician_on_the_way',
      p_recipient => v_email,
      p_template_vars => jsonb_build_object(
        'client_name', v_client_name,
        'CLIENT_FIRST_NAME', split_part(v_client_name, ' ', 1),
        'CLIENT_FULL_NAME', v_client_name,
        'order_number', v_order_number,
        'ORDER_NUMBER', v_order_number,
        'appointment_id', v_appt.id,
        'appointment_number', COALESCE(v_appt.appointment_number, ''),
        'appointment_date', v_date,
        'APPOINTMENT_DATE', v_date,
        'appointment_time', v_time,
        'APPOINTMENT_TIME', v_time,
        'service_address', v_address,
        'appointment_address_line1', v_address,
        'APPOINTMENT_ADDRESS_LINE1', v_address,
        'technician_name', v_technician_name,
        'TECHNICIAN_NAME', v_technician_name,
        'scheduled_at', v_appt.scheduled_at
      ),
      p_idempotency_key => 'core_installation_reminder_1h:' || v_appt.id::text,
      p_category => 'transactional',
      p_entity_type => 'order',
      p_entity_id => v_appt.order_id::text,
      p_reason => 'Technician reminder scheduled 1 hour before installation window',
      p_subject => 'Votre technicien arrive bientôt — Nivra',
      p_scheduled_for => v_reminder_at
    );
  ELSE
    v_reminder_result := jsonb_build_object('queued', false, 'reason', 'reminder_window_already_passed');
  END IF;

  RETURN jsonb_build_object(
    'queued', true,
    'confirmation', v_confirm_result,
    'reminder_1h', v_reminder_result,
    'appointment_id', v_appt.id,
    'scheduled_for', v_reminder_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_appointment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.technician_id IS NOT NULL
     AND NEW.scheduled_at IS NOT NULL THEN
    PERFORM public.fn_enqueue_core_installation_emails(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_appointment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_queue_existing_confirmed_installation_emails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer := 0;
  v_appt record;
BEGIN
  FOR v_appt IN
    SELECT a.id
    FROM public.appointments a
    WHERE a.order_id IS NOT NULL
      AND a.status = 'confirmed'
      AND a.technician_id IS NOT NULL
      AND a.scheduled_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.communication_audit_log cal
        WHERE cal.idempotency_key = 'core_installation_confirmed:' || a.id::text
      )
  LOOP
    PERFORM public.fn_enqueue_core_installation_emails(v_appt.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count);
END;
$$;

SELECT public.fn_queue_existing_confirmed_installation_emails();