-- BUG N11 FIX
-- RISQUE A: Trigger bails when scheduled_at IS NULL -> technician_assignment never created
-- RISQUE B: Tech status changes never propagate to work_orders (admin stuck at "assigned")

-- ==========================================================================
-- RISQUE A step 1: make schedule columns nullable
-- ==========================================================================

ALTER TABLE public.technician_assignments
  ALTER COLUMN scheduled_date       DROP NOT NULL,
  ALTER COLUMN scheduled_time_start DROP NOT NULL,
  ALTER COLUMN scheduled_time_end   DROP NOT NULL;

-- ==========================================================================
-- RISQUE A step 2: rewrite trigger - only bail when order_id OR technician_id
-- is NULL, NOT when scheduled_at is NULL. Dates are filled later when set.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.sync_technician_assignment_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start              timestamptz;
  v_status             text;
  v_technician_user_id uuid;
BEGIN
  IF NEW.order_id IS NULL OR NEW.technician_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.user_id
  INTO v_technician_user_id
  FROM public.technicians t
  WHERE t.id = NEW.technician_id
  LIMIT 1;

  IF v_technician_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_start := NEW.scheduled_at;

  v_status := CASE lower(coalesce(NEW.status, 'scheduled'))
    WHEN 'completed'           THEN 'completed'
    WHEN 'cancelled'           THEN 'cancelled'
    WHEN 'canceled'            THEN 'cancelled'
    WHEN 'missed'              THEN 'missed'
    WHEN 'no_show'             THEN 'missed'
    WHEN 'rescheduled'         THEN 'rescheduled'
    WHEN 'en_route'            THEN 'en_route'
    WHEN 'arrived'             THEN 'arrived'
    WHEN 'in_progress'         THEN 'in_progress'
    ELSE 'scheduled'
  END;

  UPDATE public.technician_assignments
  SET
    technician_id        = v_technician_user_id,
    scheduled_date       = CASE WHEN v_start IS NOT NULL
                             THEN (v_start AT TIME ZONE 'America/Toronto')::date
                             ELSE scheduled_date END,
    scheduled_time_start = CASE WHEN v_start IS NOT NULL
                             THEN (v_start AT TIME ZONE 'America/Toronto')::time
                             ELSE scheduled_time_start END,
    scheduled_time_end   = CASE WHEN v_start IS NOT NULL
                             THEN ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120)))
                                    AT TIME ZONE 'America/Toronto')::time
                             ELSE scheduled_time_end END,
    status               = v_status,
    updated_at           = now()
  WHERE order_id = NEW.order_id;

  IF NOT FOUND THEN
    INSERT INTO public.technician_assignments (
      order_id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end, status
    ) VALUES (
      NEW.order_id,
      v_technician_user_id,
      CASE WHEN v_start IS NOT NULL THEN (v_start AT TIME ZONE 'America/Toronto')::date ELSE NULL END,
      CASE WHEN v_start IS NOT NULL THEN (v_start AT TIME ZONE 'America/Toronto')::time ELSE NULL END,
      CASE WHEN v_start IS NOT NULL
        THEN ((v_start + make_interval(mins => coalesce(NEW.duration_minutes, 120)))
               AT TIME ZONE 'America/Toronto')::time
        ELSE NULL END,
      v_status
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_technician_assignment_from_appointment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_technician_assignment_from_appointment() TO authenticated;

-- ==========================================================================
-- RISQUE A step 3: backfill appointments with technician_id but no assignment
-- ==========================================================================

INSERT INTO public.technician_assignments (
  order_id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end, status
)
SELECT
  a.order_id,
  t.user_id,
  CASE WHEN a.scheduled_at IS NOT NULL
    THEN (a.scheduled_at AT TIME ZONE 'America/Toronto')::date ELSE NULL END,
  CASE WHEN a.scheduled_at IS NOT NULL
    THEN (a.scheduled_at AT TIME ZONE 'America/Toronto')::time ELSE NULL END,
  CASE WHEN a.scheduled_at IS NOT NULL
    THEN ((a.scheduled_at + make_interval(mins => coalesce(a.duration_minutes, 120)))
           AT TIME ZONE 'America/Toronto')::time
    ELSE NULL END,
  CASE lower(coalesce(a.status, 'scheduled'))
    WHEN 'completed'           THEN 'completed'
    WHEN 'cancelled'           THEN 'cancelled'
    WHEN 'canceled'            THEN 'cancelled'
    WHEN 'missed'              THEN 'missed'
    WHEN 'no_show'             THEN 'missed'
    WHEN 'rescheduled'         THEN 'rescheduled'
    WHEN 'technician_assigned' THEN 'scheduled'
    ELSE 'scheduled'
  END
FROM public.appointments a
JOIN public.technicians t ON t.id = a.technician_id
WHERE a.order_id IS NOT NULL
  AND a.technician_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.technician_assignments ta
    WHERE ta.order_id = a.order_id
  );

-- ==========================================================================
-- RISQUE A step 4: create the appointments trigger (was missing from live DB)
-- ==========================================================================

DROP TRIGGER IF EXISTS trg_sync_technician_assignment_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_technician_assignment_from_appointment
AFTER INSERT OR UPDATE OF order_id, technician_id, scheduled_at, status, duration_minutes
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_technician_assignment_from_appointment();

-- ==========================================================================
-- RISQUE B step 1: trigger syncs technician_assignments.status -> work_orders.status
-- Link: technician_assignments.order_id = work_orders.linked_order_id
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_work_order_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo_status public.work_order_status;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_wo_status := CASE NEW.status
    WHEN 'scheduled'   THEN 'scheduled'::public.work_order_status
    WHEN 'rescheduled' THEN 'scheduled'::public.work_order_status
    WHEN 'en_route'    THEN 'in_progress'::public.work_order_status
    WHEN 'arrived'     THEN 'in_progress'::public.work_order_status
    WHEN 'in_progress' THEN 'in_progress'::public.work_order_status
    WHEN 'completed'   THEN 'completed'::public.work_order_status
    WHEN 'cancelled'   THEN 'cancelled'::public.work_order_status
    WHEN 'missed'      THEN 'cancelled'::public.work_order_status
    ELSE NULL
  END;

  IF v_wo_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.work_orders
  SET
    status       = v_wo_status,
    started_at   = CASE WHEN v_wo_status IN (
                       'in_progress'::public.work_order_status,
                       'completed'::public.work_order_status)
                     THEN COALESCE(started_at, now()) ELSE started_at END,
    completed_at = CASE WHEN v_wo_status = 'completed'::public.work_order_status
                     THEN COALESCE(completed_at, now()) ELSE completed_at END,
    updated_at   = now()
  WHERE linked_order_id = NEW.order_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_work_order_from_assignment ON public.technician_assignments;
CREATE TRIGGER trg_sync_work_order_from_assignment
AFTER UPDATE OF status ON public.technician_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_work_order_from_assignment();

-- ==========================================================================
-- RISQUE B step 2: backfill work_orders still at "assigned"/"scheduled"
-- whose technician_assignment has already progressed
-- ==========================================================================

UPDATE public.work_orders wo
SET
  status = CASE ta.status
    WHEN 'scheduled'   THEN 'scheduled'::public.work_order_status
    WHEN 'rescheduled' THEN 'scheduled'::public.work_order_status
    WHEN 'en_route'    THEN 'in_progress'::public.work_order_status
    WHEN 'arrived'     THEN 'in_progress'::public.work_order_status
    WHEN 'in_progress' THEN 'in_progress'::public.work_order_status
    WHEN 'completed'   THEN 'completed'::public.work_order_status
    WHEN 'cancelled'   THEN 'cancelled'::public.work_order_status
    WHEN 'missed'      THEN 'cancelled'::public.work_order_status
    ELSE wo.status
  END,
  started_at   = CASE WHEN ta.status IN ('en_route','arrived','in_progress','completed')
                   THEN COALESCE(wo.started_at, ta.updated_at) ELSE wo.started_at END,
  completed_at = CASE WHEN ta.status = 'completed'
                   THEN COALESCE(wo.completed_at, ta.completed_at, ta.updated_at) ELSE wo.completed_at END,
  updated_at   = now()
FROM public.technician_assignments ta
WHERE ta.order_id = wo.linked_order_id
  AND wo.status IN ('assigned', 'scheduled');