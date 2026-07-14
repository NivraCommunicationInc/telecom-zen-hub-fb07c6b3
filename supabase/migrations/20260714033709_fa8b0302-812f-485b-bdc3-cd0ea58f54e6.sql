-- =========================================================
-- INTERVENTION WORKFLOW — Portail /tech v3
-- =========================================================

CREATE TABLE public.intervention_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  assignment_id uuid,
  order_id uuid,
  service_kind text NOT NULL DEFAULT 'internet',
  current_step text NOT NULL DEFAULT 'arrival',
  status text NOT NULL DEFAULT 'active',
  progress int NOT NULL DEFAULT 0,
  arrival_gps_lat double precision,
  arrival_gps_lng double precision,
  arrival_accuracy_m double precision,
  client_full_name text,
  service_address text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervention_sessions_step_ck CHECK (current_step IN (
    'arrival','checklist','equipment','test_internet','test_wifi','test_tv',
    'activation','wifi_config','client_validation','photos','signature','closed'
  )),
  CONSTRAINT intervention_sessions_status_ck CHECK (status IN ('active','completed','cancelled'))
);
CREATE INDEX intervention_sessions_tech_idx ON public.intervention_sessions(technician_id, status);
CREATE INDEX intervention_sessions_assignment_idx ON public.intervention_sessions(assignment_id);
CREATE INDEX intervention_sessions_order_idx ON public.intervention_sessions(order_id);
CREATE UNIQUE INDEX intervention_sessions_active_per_assignment_ux
  ON public.intervention_sessions(assignment_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_sessions TO authenticated;
GRANT ALL ON public.intervention_sessions TO service_role;
ALTER TABLE public.intervention_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_reads_own_sessions" ON public.intervention_sessions FOR SELECT TO authenticated
  USING (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "tech_inserts_own_sessions" ON public.intervention_sessions FOR INSERT TO authenticated
  WITH CHECK (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "tech_updates_own_sessions" ON public.intervention_sessions FOR UPDATE TO authenticated
  USING (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));


CREATE TABLE public.intervention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  step text NOT NULL,
  action text NOT NULL DEFAULT 'complete',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  gps_lat double precision,
  gps_lng double precision,
  actor uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intervention_events_session_idx ON public.intervention_events(session_id, created_at);
GRANT SELECT, INSERT ON public.intervention_events TO authenticated;
GRANT ALL ON public.intervention_events TO service_role;
ALTER TABLE public.intervention_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_reads_own_events" ON public.intervention_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY "tech_inserts_own_events" ON public.intervention_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE TABLE public.intervention_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  code text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, code)
);
CREATE INDEX intervention_checklist_session_idx ON public.intervention_checklist_items(session_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_checklist_items TO authenticated;
GRANT ALL ON public.intervention_checklist_items TO service_role;
ALTER TABLE public.intervention_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_manages_own_checklist" ON public.intervention_checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE TABLE public.intervention_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  serial text NOT NULL,
  mac text,
  verified boolean NOT NULL DEFAULT false,
  scanned_via text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, serial)
);
CREATE INDEX intervention_equipment_session_idx ON public.intervention_equipment(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_equipment TO authenticated;
GRANT ALL ON public.intervention_equipment TO service_role;
ALTER TABLE public.intervention_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_manages_own_equipment" ON public.intervention_equipment FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE TABLE public.intervention_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  ran_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, kind)
);
CREATE INDEX intervention_tests_session_idx ON public.intervention_tests(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_tests TO authenticated;
GRANT ALL ON public.intervention_tests TO service_role;
ALTER TABLE public.intervention_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_manages_own_tests" ON public.intervention_tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE TABLE public.intervention_wifi_config (
  session_id uuid PRIMARY KEY REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  ssid text NOT NULL,
  password text NOT NULL,
  band text NOT NULL DEFAULT 'dual',
  security text NOT NULL DEFAULT 'WPA2',
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_wifi_config TO authenticated;
GRANT ALL ON public.intervention_wifi_config TO service_role;
ALTER TABLE public.intervention_wifi_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_manages_own_wifi" ON public.intervention_wifi_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE TABLE public.intervention_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.intervention_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_path text NOT NULL,
  bytes bigint,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intervention_media_session_idx ON public.intervention_media(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_media TO authenticated;
GRANT ALL ON public.intervention_media TO service_role;
ALTER TABLE public.intervention_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_manages_own_media" ON public.intervention_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intervention_sessions s WHERE s.id = session_id AND (s.technician_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));


CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER intervention_sessions_touch BEFORE UPDATE ON public.intervention_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER intervention_checklist_touch BEFORE UPDATE ON public.intervention_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER intervention_wifi_touch BEFORE UPDATE ON public.intervention_wifi_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.fn_start_intervention(
  p_assignment_id uuid,
  p_service_kind text DEFAULT 'internet',
  p_gps_lat double precision DEFAULT NULL,
  p_gps_lng double precision DEFAULT NULL,
  p_gps_accuracy double precision DEFAULT NULL
)
RETURNS public.intervention_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_tech uuid := auth.uid();
  v_existing public.intervention_sessions;
  v_new public.intervention_sessions;
  v_client text; v_addr text; v_order uuid;
BEGIN
  IF v_tech IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_assignment_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.intervention_sessions
      WHERE assignment_id = p_assignment_id AND status = 'active' LIMIT 1;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  BEGIN
    EXECUTE 'SELECT client_full_name, service_address, order_id
             FROM public.technician_assignments WHERE id = $1'
      INTO v_client, v_addr, v_order USING p_assignment_id;
  EXCEPTION WHEN OTHERS THEN
    v_client := NULL; v_addr := NULL; v_order := NULL;
  END;

  INSERT INTO public.intervention_sessions(
    technician_id, assignment_id, order_id, service_kind,
    arrival_gps_lat, arrival_gps_lng, arrival_accuracy_m,
    client_full_name, service_address
  ) VALUES (
    v_tech, p_assignment_id, v_order, coalesce(p_service_kind,'internet'),
    p_gps_lat, p_gps_lng, p_gps_accuracy, v_client, v_addr
  ) RETURNING * INTO v_new;

  INSERT INTO public.intervention_checklist_items(session_id, position, code, label, required)
  SELECT v_new.id, ord, code, label, req FROM (
    VALUES
      (1,'greet_client','Se présenter au client et confirmer identité', true),
      (2,'verify_workorder','Vérifier bon de travail et périmètre', true),
      (3,'inspect_site','Inspection visuelle du site', true),
      (4,'confirm_power','Confirmer alimentation électrique disponible', true),
      (5,'confirm_cabling','Confirmer câblage / port d''arrivée', true)
  ) AS t(ord, code, label, req);

  INSERT INTO public.intervention_events(session_id, step, action, payload, gps_lat, gps_lng)
    VALUES (v_new.id, 'arrival', 'start',
      jsonb_build_object('service_kind', v_new.service_kind, 'assignment_id', p_assignment_id),
      p_gps_lat, p_gps_lng);

  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_start_intervention(uuid, text, double precision, double precision, double precision) TO authenticated;


CREATE OR REPLACE FUNCTION public.fn_advance_step(
  p_session_id uuid, p_from_step text, p_to_step text, p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.intervention_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_tech uuid := auth.uid();
  v_row public.intervention_sessions;
  v_order text[] := ARRAY[
    'arrival','checklist','equipment','test_internet','test_wifi','test_tv',
    'activation','wifi_config','client_validation','photos','signature','closed'
  ];
  v_from_idx int; v_to_idx int;
BEGIN
  IF v_tech IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.intervention_sessions
    WHERE id = p_session_id
      AND (technician_id = v_tech OR public.has_role(v_tech,'admin'::app_role))
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found_or_forbidden'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'session_not_active'; END IF;
  IF v_row.current_step <> p_from_step THEN
    RAISE EXCEPTION 'step_mismatch: session at % expected %', v_row.current_step, p_from_step;
  END IF;

  v_from_idx := array_position(v_order, p_from_step);
  v_to_idx   := array_position(v_order, p_to_step);
  IF v_to_idx IS NULL OR v_from_idx IS NULL OR v_to_idx <> v_from_idx + 1 THEN
    RAISE EXCEPTION 'invalid_transition: % -> %', p_from_step, p_to_step;
  END IF;

  UPDATE public.intervention_sessions
    SET current_step = p_to_step, progress = v_to_idx, updated_at = now()
    WHERE id = p_session_id RETURNING * INTO v_row;

  INSERT INTO public.intervention_events(session_id, step, action, payload)
    VALUES (p_session_id, p_from_step, 'complete', coalesce(p_payload,'{}'::jsonb));

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_advance_step(uuid, text, text, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.fn_activate_service_for_intervention(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_tech uuid := auth.uid();
  v_row public.intervention_sessions;
BEGIN
  SELECT * INTO v_row FROM public.intervention_sessions
    WHERE id = p_session_id
      AND (technician_id = v_tech OR public.has_role(v_tech,'admin'::app_role));
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found_or_forbidden'; END IF;

  INSERT INTO public.intervention_events(session_id, step, action, payload)
    VALUES (p_session_id, 'activation', 'run',
      jsonb_build_object('service_kind', v_row.service_kind, 'order_id', v_row.order_id));

  RETURN jsonb_build_object('ok', true, 'service_kind', v_row.service_kind, 'order_id', v_row.order_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_activate_service_for_intervention(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.fn_close_intervention(p_session_id uuid)
RETURNS public.intervention_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_tech uuid := auth.uid();
  v_row public.intervention_sessions;
  v_missing int;
BEGIN
  IF v_tech IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.intervention_sessions
    WHERE id = p_session_id
      AND (technician_id = v_tech OR public.has_role(v_tech,'admin'::app_role))
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found_or_forbidden'; END IF;
  IF v_row.current_step <> 'signature' THEN
    RAISE EXCEPTION 'cannot_close_before_signature (current: %)', v_row.current_step;
  END IF;

  SELECT count(*) INTO v_missing FROM public.intervention_checklist_items
    WHERE session_id = p_session_id AND required = true AND checked = false;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'checklist_incomplete: % item(s) manquant(s)', v_missing;
  END IF;

  UPDATE public.intervention_sessions
    SET current_step = 'closed', status = 'completed',
        completed_at = now(), progress = 12, updated_at = now()
    WHERE id = p_session_id RETURNING * INTO v_row;

  INSERT INTO public.intervention_events(session_id, step, action, payload)
    VALUES (p_session_id, 'closed', 'complete', jsonb_build_object('at', now()));

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_close_intervention(uuid) TO authenticated;