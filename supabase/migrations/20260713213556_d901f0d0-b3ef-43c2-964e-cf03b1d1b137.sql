ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduling_status text,
  ADD COLUMN IF NOT EXISTS dispatch_priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS dispatch_notes text,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer DEFAULT 120;

CREATE TABLE IF NOT EXISTS public.dispatch_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  technician_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_reservations TO authenticated;
GRANT ALL ON public.dispatch_reservations TO service_role;

ALTER TABLE public.dispatch_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians can view dispatch reservations" ON public.dispatch_reservations;
CREATE POLICY "Technicians can view dispatch reservations"
ON public.dispatch_reservations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'technician'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'techops'::app_role)
);

DROP POLICY IF EXISTS "Technicians can reserve dispatch missions" ON public.dispatch_reservations;
CREATE POLICY "Technicians can reserve dispatch missions"
ON public.dispatch_reservations
FOR ALL
TO authenticated
USING (
  technician_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'techops'::app_role)
)
WITH CHECK (
  technician_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'techops'::app_role)
);

CREATE OR REPLACE FUNCTION public.reserve_dispatch_slot(
  p_order_id uuid,
  p_technician_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.dispatch_reservations%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF p_technician_id <> v_actor
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
     ) THEN
    RAISE EXCEPTION 'Accès refusé';
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

  DELETE FROM public.dispatch_reservations WHERE expires_at <= now();

  SELECT * INTO v_existing
  FROM public.dispatch_reservations
  WHERE order_id = p_order_id;

  IF FOUND AND v_existing.technician_id <> p_technician_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission déjà réservée par un autre technicien', 'expires_at', v_existing.expires_at);
  END IF;

  INSERT INTO public.dispatch_reservations(order_id, technician_id, expires_at)
  VALUES (p_order_id, p_technician_id, now() + interval '15 minutes')
  ON CONFLICT (order_id) DO UPDATE
    SET technician_id = EXCLUDED.technician_id,
        expires_at = EXCLUDED.expires_at,
        created_at = now();

  RETURN jsonb_build_object('success', true, 'expires_at', now() + interval '15 minutes');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_dispatch_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_dispatch_slot(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_dispatch_assignment(
  p_order_id uuid,
  p_technician_id uuid,
  p_scheduled_date date,
  p_time_start time,
  p_time_end time
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_assignment_id uuid;
  v_scheduled_at timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF p_technician_id <> v_actor
     AND NOT (
       public.has_role(v_actor, 'admin'::app_role)
       OR public.has_role(v_actor, 'employee'::app_role)
       OR public.has_role(v_actor, 'supervisor'::app_role)
       OR public.has_role(v_actor, 'techops'::app_role)
     ) THEN
    RAISE EXCEPTION 'Accès refusé';
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

  DELETE FROM public.dispatch_reservations WHERE expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.dispatch_reservations
    WHERE order_id = p_order_id
      AND technician_id <> p_technician_id
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission réservée par un autre technicien');
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.technician_assignments
  WHERE order_id = p_order_id
    AND status NOT IN ('completed','cancelled','missed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_assignment_id IS NULL THEN
    INSERT INTO public.technician_assignments(order_id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end, status)
    VALUES (p_order_id, p_technician_id, p_scheduled_date, p_time_start, p_time_end, 'scheduled')
    RETURNING id INTO v_assignment_id;
  ELSE
    UPDATE public.technician_assignments
    SET technician_id = p_technician_id,
        scheduled_date = p_scheduled_date,
        scheduled_time_start = p_time_start,
        scheduled_time_end = p_time_end,
        status = 'scheduled',
        updated_at = now()
    WHERE id = v_assignment_id
      AND (technician_id IS NULL OR technician_id = p_technician_id);

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mission déjà attribuée');
    END IF;
  END IF;

  v_scheduled_at := (p_scheduled_date::text || ' ' || p_time_start::text)::timestamp AT TIME ZONE 'America/Toronto';

  UPDATE public.appointments
  SET technician_id = p_technician_id,
      scheduled_at = v_scheduled_at,
      status = CASE WHEN status IN ('completed','cancelled','no_show') THEN status ELSE 'scheduled' END,
      updated_at = now(),
      updated_by = v_actor
  WHERE order_id = p_order_id
    AND status NOT IN ('completed','cancelled','no_show');

  UPDATE public.orders
  SET scheduling_status = 'scheduled',
      updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.dispatch_reservations WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_dispatch_assignment(uuid, uuid, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_assignment(uuid, uuid, date, time, time) TO authenticated;

CREATE OR REPLACE FUNCTION public.tech_update_assignment_status(
  p_assignment_id uuid,
  p_status text,
  p_note text DEFAULT NULL::text,
  p_eta text DEFAULT NULL::text,
  p_wifi_ssid text DEFAULT NULL::text,
  p_wifi_password text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assignment public.technician_assignments%ROWTYPE;
  v_appt_id uuid;
  v_appt_status text;
  v_notes text;
  v_actor uuid := auth.uid();
  v_extra jsonb := '{}'::jsonb;
  v_template text;
  v_network jsonb;
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
     ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas assigné à cette mission';
  END IF;

  v_notes := NULLIF(trim(coalesce(p_note, '')), '');
  v_network := COALESCE(v_assignment.network_test_results, '{}'::jsonb);

  IF NULLIF(trim(coalesce(p_wifi_ssid, '')), '') IS NOT NULL THEN
    v_network := v_network || jsonb_build_object('wifi_ssid', trim(p_wifi_ssid));
  END IF;
  IF NULLIF(trim(coalesce(p_wifi_password, '')), '') IS NOT NULL THEN
    v_network := v_network || jsonb_build_object('wifi_password', trim(p_wifi_password));
  END IF;

  UPDATE public.technician_assignments
  SET
    status = p_status,
    technician_id = COALESCE(technician_id, v_actor),
    missed_at = CASE WHEN p_status = 'missed' THEN now() ELSE missed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    client_notified_en_route = CASE WHEN p_status = 'en_route' THEN true ELSE client_notified_en_route END,
    client_notified_missed = CASE WHEN p_status = 'missed' THEN true ELSE client_notified_missed END,
    network_test_results = v_network,
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
        technician_id = COALESCE(technician_id, v_assignment.technician_id),
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
      WHEN 'completed' THEN jsonb_build_object(
        'speed', COALESCE(v_assignment.download_speed::text || ' Mbps', 'Optimale'),
        'wifi_ssid', COALESCE(NULLIF(trim(coalesce(p_wifi_ssid, '')), ''), v_assignment.network_test_results->>'wifi_ssid'),
        'wifi_password', COALESCE(NULLIF(trim(coalesce(p_wifi_password, '')), ''), v_assignment.network_test_results->>'wifi_password')
      )
      WHEN 'missed' THEN jsonb_build_object('reason', COALESCE(v_notes, 'Client absent / rendez-vous manqué'))
      ELSE '{}'::jsonb
    END;

    PERFORM public.queue_tech_status_email(p_assignment_id, v_template, v_extra);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tech_update_assignment_status(uuid, text, text, text, text, text) TO authenticated;