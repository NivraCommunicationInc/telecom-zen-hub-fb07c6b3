CREATE OR REPLACE FUNCTION public.sync_technician_assignment_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    ELSE 'scheduled'
  END;

  UPDATE public.technician_assignments
  SET
    technician_id = v_technician_user_id,
    scheduled_date = (v_start AT TIME ZONE 'America/Toronto')::date,
    scheduled_time_start = (v_start AT TIME ZONE 'America/Toronto')::time,
    scheduled_time_end = ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120))) AT TIME ZONE 'America/Toronto')::time,
    status = v_status,
    updated_at = now()
  WHERE order_id = NEW.order_id
    AND (
      technician_id IS DISTINCT FROM v_technician_user_id
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
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_technician_assignment_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scheduled timestamptz;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.scheduled_date IS NOT NULL THEN
    v_scheduled := (NEW.scheduled_date + coalesce(NEW.scheduled_time_start, '09:00'::time))::timestamptz;
  ELSE
    v_scheduled := NEW.completed_at;
  END IF;

  PERFORM public.fn_upsert_canonical_appointment_from_legacy(
    'technician_assignments', NEW.id, NEW.order_id, NULL, NULL,
    NEW.service_address_id, NEW.technician_id, v_scheduled, NEW.status,
    NULL, NULL, NULL, NULL, NULL, 'installation', 'Installation', NEW.technician_notes
  );
  RETURN NEW;
END;
$$;