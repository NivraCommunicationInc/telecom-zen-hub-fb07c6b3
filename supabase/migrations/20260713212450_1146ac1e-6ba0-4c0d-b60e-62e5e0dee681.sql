-- Suppress client email when technician marks "arrived" (per product decision).
-- All other tech statuses continue to notify the client via queue_tech_status_email.
CREATE OR REPLACE FUNCTION public.tech_update_assignment_status(p_assignment_id uuid, p_status text, p_note text DEFAULT NULL::text, p_eta text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment public.technician_assignments%ROWTYPE;
  v_appt_id uuid;
  v_appt_status text;
  v_notes text;
  v_actor uuid := auth.uid();
  v_extra jsonb := '{}'::jsonb;
  v_template text;
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

  IF p_status NOT IN ('scheduled','en_route','arrived','in_progress','completed','missed','rescheduled','cancelled') THEN
    RAISE EXCEPTION 'Statut technicien invalide: %', p_status;
  END IF;

  SELECT * INTO v_assignment FROM public.technician_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;

  IF v_assignment.technician_id IS NOT NULL
     AND v_assignment.technician_id <> v_actor
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
     )
  THEN
    RAISE EXCEPTION 'Vous n''êtes pas assigné à cette mission';
  END IF;

  v_notes := NULLIF(trim(coalesce(p_note, '')), '');

  UPDATE public.technician_assignments
  SET
    status = p_status,
    technician_id = COALESCE(technician_id, v_actor),
    missed_at = CASE WHEN p_status = 'missed' THEN now() ELSE missed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    client_notified_en_route = CASE WHEN p_status = 'en_route' THEN true ELSE client_notified_en_route END,
    client_notified_missed = CASE WHEN p_status = 'missed' THEN true ELSE client_notified_missed END,
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
      v_appt_status := CASE p_status WHEN 'missed' THEN 'no_show' ELSE p_status END;

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

  -- Client emails: 'arrived' explicitly does NOT trigger a client email
  -- (product decision — technician physically present, no notification needed).
  v_template := CASE p_status
    WHEN 'en_route' THEN 'tech_en_route'
    WHEN 'in_progress' THEN 'tech_in_progress'
    WHEN 'completed' THEN 'tech_completed'
    WHEN 'missed' THEN 'tech_missed'
    WHEN 'rescheduled' THEN 'tech_rescheduled'
    ELSE NULL
  END;

  IF v_template IS NOT NULL THEN
    v_extra := CASE p_status
      WHEN 'en_route' THEN jsonb_build_object('eta', COALESCE(NULLIF(trim(coalesce(p_eta, '')), ''), 'sous peu'))
      WHEN 'in_progress' THEN jsonb_build_object('start_time', to_char(now() AT TIME ZONE 'America/Toronto', 'HH24:MI'))
      WHEN 'completed' THEN jsonb_build_object('speed', COALESCE(v_assignment.download_speed::text || ' Mbps', 'Optimale'))
      WHEN 'missed' THEN jsonb_build_object('reason', COALESCE(v_notes, 'Client absent / rendez-vous manqué'))
      ELSE '{}'::jsonb
    END;

    PERFORM public.queue_tech_status_email(p_assignment_id, v_template, v_extra);
  END IF;
END;
$function$;