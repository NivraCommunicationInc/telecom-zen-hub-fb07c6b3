CREATE OR REPLACE FUNCTION public.fn_resolve_technician_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Accept both canonical technician profile IDs and auth/profile user IDs.
  SELECT t.id INTO v_profile_id
  FROM public.technicians t
  WHERE t.id = _user_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN v_profile_id;
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
  WHERE p.user_id = _user_id
  LIMIT 1;

  IF v_email IS NULL THEN
    v_email := 'tech-' || _user_id::text || '@internal.nivra.local';
  END IF;

  INSERT INTO public.technicians(user_id, full_name, email, status)
  VALUES (_user_id, COALESCE(v_name, 'Technicien'), v_email, 'active')
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_sync_technician_assignment_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scheduled timestamptz;
  v_technician_profile_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.scheduled_date IS NOT NULL THEN
    v_scheduled := (NEW.scheduled_date + coalesce(NEW.scheduled_time_start, '09:00'::time))::timestamptz;
  ELSE
    v_scheduled := NEW.completed_at;
  END IF;

  v_technician_profile_id := public.fn_resolve_technician_profile_id(NEW.technician_id);

  PERFORM public.fn_upsert_canonical_appointment_from_legacy(
    'technician_assignments',
    NEW.id,
    NEW.order_id,
    NULL,
    NULL,
    NEW.service_address_id,
    v_technician_profile_id,
    v_scheduled,
    NEW.status,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'installation',
    'Installation',
    NEW.technician_notes
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_technician_assignment_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_status text;
  v_technician_user_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.user_id
  INTO v_technician_user_id
  FROM public.technicians t
  WHERE t.id = NEW.technician_id
  LIMIT 1;

  v_start := NEW.scheduled_at;
  v_status := CASE lower(coalesce(NEW.status, 'scheduled'))
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'missed' THEN 'missed'
    WHEN 'no_show' THEN 'missed'
    WHEN 'rescheduled' THEN 'rescheduled'
    WHEN 'en_route' THEN 'en_route'
    WHEN 'arrived' THEN 'arrived'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'confirmed' THEN 'accepted'
    ELSE 'scheduled'
  END;

  UPDATE public.technician_assignments
  SET
    technician_id = COALESCE(v_technician_user_id, technician_id),
    scheduled_date = (v_start AT TIME ZONE 'America/Toronto')::date,
    scheduled_time_start = (v_start AT TIME ZONE 'America/Toronto')::time,
    scheduled_time_end = ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120))) AT TIME ZONE 'America/Toronto')::time,
    status = v_status,
    updated_at = now()
  WHERE order_id = NEW.order_id
    AND (
      technician_id IS DISTINCT FROM COALESCE(v_technician_user_id, technician_id)
      OR scheduled_date IS DISTINCT FROM (v_start AT TIME ZONE 'America/Toronto')::date
      OR scheduled_time_start IS DISTINCT FROM (v_start AT TIME ZONE 'America/Toronto')::time
      OR scheduled_time_end IS DISTINCT FROM ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120))) AT TIME ZONE 'America/Toronto')::time
      OR status IS DISTINCT FROM v_status
    );

  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.technician_assignments WHERE order_id = NEW.order_id) THEN
    INSERT INTO public.technician_assignments (
      order_id,
      technician_id,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      status
    ) VALUES (
      NEW.order_id,
      v_technician_user_id,
      (v_start AT TIME ZONE 'America/Toronto')::date,
      (v_start AT TIME ZONE 'America/Toronto')::time,
      ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120))) AT TIME ZONE 'America/Toronto')::time,
      v_status
    );
  END IF;

  RETURN NEW;
END;
$function$;