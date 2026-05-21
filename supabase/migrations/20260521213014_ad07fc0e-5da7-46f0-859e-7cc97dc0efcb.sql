CREATE OR REPLACE FUNCTION public.sync_technician_assignment_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_status text;
BEGIN
  IF NEW.order_id IS NULL OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

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
    technician_id = NEW.technician_id,
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
      NEW.technician_id,
      (v_start AT TIME ZONE 'America/Toronto')::date,
      (v_start AT TIME ZONE 'America/Toronto')::time,
      ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120))) AT TIME ZONE 'America/Toronto')::time,
      v_status
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_technician_assignment_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_technician_assignment_from_appointment
AFTER INSERT OR UPDATE OF order_id, technician_id, scheduled_at, status, duration_minutes
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_technician_assignment_from_appointment();