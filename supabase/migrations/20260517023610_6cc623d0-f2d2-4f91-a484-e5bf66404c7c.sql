-- ============================================================
-- TRAINING SYSTEM — Nivra Field Agent Training
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'introduction','products','field_portal','sales_techniques',
    'presentation','policies','regulations','billing_contracts'
  )),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  passing_score INTEGER NOT NULL DEFAULT 80,
  points_reward INTEGER NOT NULL DEFAULT 100,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  content_type TEXT NOT NULL DEFAULT 'mixed'
    CHECK (content_type IN ('video','text','mixed','live_session')),
  video_url TEXT,
  content_fr TEXT,
  content_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_modules_category_order
  ON public.training_modules(category, order_index);

CREATE TABLE IF NOT EXISTS public.training_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  question_fr TEXT NOT NULL,
  question_en TEXT NOT NULL,
  options_fr JSONB NOT NULL,
  options_en JSONB NOT NULL,
  correct_option INTEGER NOT NULL,
  explanation_fr TEXT,
  explanation_en TEXT,
  points INTEGER NOT NULL DEFAULT 20,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_questions_module ON public.training_questions(module_id, order_index);

CREATE TABLE IF NOT EXISTS public.training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed','failed')),
  score INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (agent_id, module_id)
);
CREATE INDEX IF NOT EXISTS ix_training_progress_agent ON public.training_progress(agent_id);

CREATE TABLE IF NOT EXISTS public.training_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id UUID NOT NULL REFERENCES public.training_progress(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.training_questions(id) ON DELETE CASCADE,
  selected_option INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_answers_progress ON public.training_answers(progress_id);

CREATE TABLE IF NOT EXISTS public.training_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  certification_name TEXT NOT NULL,
  certification_level TEXT NOT NULL
    CHECK (certification_level IN ('certified','confirmed','top_seller','elite')),
  total_points INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  pdf_url TEXT,
  badge_color TEXT NOT NULL DEFAULT '#7C3AED',
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_certifications_active
  ON public.training_certifications(agent_id, certification_level)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS ix_training_certifications_agent ON public.training_certifications(agent_id);

CREATE TABLE IF NOT EXISTS public.agent_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  training_points INTEGER NOT NULL DEFAULT 0,
  sales_points INTEGER NOT NULL DEFAULT 0,
  current_badge TEXT NOT NULL DEFAULT 'none'
    CHECK (current_badge IN ('none','certified','confirmed','top_seller','elite')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  trainer_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_url TEXT,
  description_fr TEXT,
  description_en TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_sessions_scheduled ON public.training_sessions(scheduled_at DESC);

CREATE TABLE IF NOT EXISTS public.training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','attended','absent','excused')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, agent_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;

-- helper macro: admin OR supervisor
-- (all policies inline below)

DROP POLICY IF EXISTS p_modules_read ON public.training_modules;
CREATE POLICY p_modules_read ON public.training_modules
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_modules_write ON public.training_modules;
CREATE POLICY p_modules_write ON public.training_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_questions_read ON public.training_questions;
CREATE POLICY p_questions_read ON public.training_questions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_questions_write ON public.training_questions;
CREATE POLICY p_questions_write ON public.training_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_progress_read ON public.training_progress;
CREATE POLICY p_progress_read ON public.training_progress
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_progress_insert ON public.training_progress;
CREATE POLICY p_progress_insert ON public.training_progress
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_progress_update ON public.training_progress;
CREATE POLICY p_progress_update ON public.training_progress
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_progress_delete ON public.training_progress;
CREATE POLICY p_progress_delete ON public.training_progress
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_answers_read ON public.training_answers;
CREATE POLICY p_answers_read ON public.training_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.training_progress tp WHERE tp.id = progress_id AND tp.agent_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role)
  );
DROP POLICY IF EXISTS p_answers_insert ON public.training_answers;
CREATE POLICY p_answers_insert ON public.training_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.training_progress tp WHERE tp.id = progress_id AND tp.agent_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role)
  );

DROP POLICY IF EXISTS p_cert_read ON public.training_certifications;
CREATE POLICY p_cert_read ON public.training_certifications
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_cert_write ON public.training_certifications;
CREATE POLICY p_cert_write ON public.training_certifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_points_read ON public.agent_points;
CREATE POLICY p_points_read ON public.agent_points
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_points_write ON public.agent_points;
CREATE POLICY p_points_write ON public.agent_points
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_sessions_read ON public.training_sessions;
CREATE POLICY p_sessions_read ON public.training_sessions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_sessions_write ON public.training_sessions;
CREATE POLICY p_sessions_write ON public.training_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_att_read ON public.training_attendance;
CREATE POLICY p_att_read ON public.training_attendance
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_att_insert ON public.training_attendance;
CREATE POLICY p_att_insert ON public.training_attendance
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));
DROP POLICY IF EXISTS p_att_update ON public.training_attendance;
CREATE POLICY p_att_update ON public.training_attendance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

-- ============================================================
-- TRIGGER: agent_points + badge + auto certification
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_update_agent_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_points INTEGER;
  v_total_training INTEGER;
  v_new_badge TEXT;
  v_all_done BOOLEAN;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT points_reward INTO v_module_points
      FROM public.training_modules WHERE id = NEW.module_id;
    v_module_points := COALESCE(v_module_points, 0);

    INSERT INTO public.agent_points (agent_id, total_points, training_points, current_badge)
    VALUES (NEW.agent_id, v_module_points, v_module_points, 'none')
    ON CONFLICT (agent_id) DO UPDATE
      SET training_points = public.agent_points.training_points + v_module_points,
          total_points    = public.agent_points.total_points    + v_module_points,
          updated_at      = now();

    SELECT training_points INTO v_total_training
      FROM public.agent_points WHERE agent_id = NEW.agent_id;

    v_new_badge := CASE
      WHEN v_total_training >= 2000 THEN 'elite'
      WHEN v_total_training >= 1000 THEN 'top_seller'
      WHEN v_total_training >= 500  THEN 'confirmed'
      WHEN v_total_training >= 100  THEN 'certified'
      ELSE 'none'
    END;

    UPDATE public.agent_points
       SET current_badge = v_new_badge, updated_at = now()
     WHERE agent_id = NEW.agent_id;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.training_modules tm
      LEFT JOIN public.training_progress tp
        ON tp.module_id = tm.id AND tp.agent_id = NEW.agent_id
      WHERE tm.is_mandatory = true AND tm.is_active = true
        AND (tp.status IS NULL OR tp.status <> 'completed')
    ) INTO v_all_done;

    IF v_all_done THEN
      INSERT INTO public.training_certifications
        (agent_id, certification_name, certification_level, total_points, issued_at, badge_color)
      VALUES
        (NEW.agent_id, 'Agent Certifié Nivra Telecom', 'certified', v_total_training, now(), '#7C3AED')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_agent_points ON public.training_progress;
CREATE TRIGGER trg_update_agent_points
AFTER UPDATE ON public.training_progress
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_agent_points();