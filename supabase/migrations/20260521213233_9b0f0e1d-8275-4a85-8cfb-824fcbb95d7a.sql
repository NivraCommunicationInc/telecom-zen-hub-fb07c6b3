CREATE OR REPLACE FUNCTION public.sync_technician_assignment_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_status text;
  v_technician_user_id uuid;
BEGIN
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
  WHERE order_id = NEW.order_id;

  IF NOT FOUND THEN
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

REVOKE ALL ON FUNCTION public.sync_technician_assignment_from_appointment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_technician_assignment_from_appointment() TO authenticated;