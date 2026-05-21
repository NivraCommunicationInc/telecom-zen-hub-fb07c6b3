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

CREATE OR REPLACE FUNCTION public.tech_update_assignment_status(
  p_assignment_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_eta text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.technician_assignments%ROWTYPE;
  v_appt_id uuid;
  v_appt_status text;
  v_notes text;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'technician')
    OR public.has_role(v_actor, 'admin')
    OR public.has_role(v_actor, 'employee')
    OR public.has_role(v_actor, 'supervisor')
    OR public.has_role(v_actor, 'techops')
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_status NOT IN ('scheduled','en_route','arrived','in_progress','completed','missed','rescheduled','cancelled') THEN
    RAISE EXCEPTION 'Statut technicien invalide: %', p_status;
  END IF;

  SELECT * INTO v_assignment
  FROM public.technician_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  v_notes := NULLIF(trim(coalesce(p_note, '')), '');

  UPDATE public.technician_assignments
  SET
    status = p_status,
    technician_id = COALESCE(technician_id, v_actor),
    missed_at = CASE WHEN p_status = 'missed' THEN now() ELSE missed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    technician_notes = CASE
      WHEN v_notes IS NULL THEN technician_notes
      WHEN technician_notes IS NULL OR technician_notes = '' THEN v_notes
      ELSE technician_notes || E'\n' || v_notes
    END,
    updated_at = now()
  WHERE id = p_assignment_id;

  IF v_assignment.order_id IS NOT NULL THEN
    SELECT id INTO v_appt_id
    FROM public.appointments
    WHERE order_id = v_assignment.order_id
    ORDER BY scheduled_at DESC
    LIMIT 1;

    IF v_appt_id IS NOT NULL THEN
      v_appt_status := CASE p_status
        WHEN 'missed' THEN 'no_show'
        ELSE p_status
      END;

      UPDATE public.appointments
      SET
        status = v_appt_status,
        updated_at = now(),
        updated_by = v_actor,
        internal_notes = CASE
          WHEN v_notes IS NULL AND NULLIF(trim(coalesce(p_eta, '')), '') IS NULL THEN internal_notes
          ELSE concat_ws(E'\n',
            NULLIF(internal_notes, ''),
            concat('[Technicien ', to_char(now(), 'YYYY-MM-DD HH24:MI'), '] ',
              CASE p_status
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
END;
$$;

REVOKE ALL ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text) TO authenticated;