-- Cleanup test artifact
DROP TABLE IF EXISTS public.training_test_tbl;

-- Extend training_modules
ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS portal TEXT NOT NULL DEFAULT 'both' CHECK (portal IN ('field','cs','both')),
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_fr TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_en TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_training_modules_slug ON public.training_modules(slug) WHERE slug IS NOT NULL;

-- training_lessons
CREATE TABLE IF NOT EXISTS public.training_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  lesson_type TEXT NOT NULL DEFAULT 'text' CHECK (lesson_type IN ('text','video','image','quiz','simulation','interactive')),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_fr TEXT,
  content_en TEXT,
  video_url TEXT,
  image_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_lessons_module ON public.training_lessons(module_id, order_index);

ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_lessons_read" ON public.training_lessons FOR SELECT TO authenticated
  USING (is_published = true OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "p_lessons_write" ON public.training_lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- training_simulations
CREATE TABLE IF NOT EXISTS public.training_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.training_modules(id) ON DELETE SET NULL,
  persona_key TEXT NOT NULL,
  persona_label_fr TEXT NOT NULL,
  persona_label_en TEXT NOT NULL,
  scenario_fr TEXT NOT NULL,
  scenario_en TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  system_prompt_fr TEXT NOT NULL,
  system_prompt_en TEXT NOT NULL,
  evaluation_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  portal TEXT NOT NULL DEFAULT 'both' CHECK (portal IN ('field','cs','both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_simulations_read" ON public.training_simulations FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "p_simulations_write" ON public.training_simulations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- training_simulation_sessions
CREATE TABLE IF NOT EXISTS public.training_simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  simulation_id UUID NOT NULL REFERENCES public.training_simulations(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER,
  feedback JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_training_sim_sessions_agent ON public.training_simulation_sessions(agent_id, started_at DESC);
ALTER TABLE public.training_simulation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_sim_sessions_read" ON public.training_simulation_sessions FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "p_sim_sessions_insert" ON public.training_simulation_sessions FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());
CREATE POLICY "p_sim_sessions_update" ON public.training_simulation_sessions FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (agent_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- Portal certification check
CREATE OR REPLACE FUNCTION public.fn_check_portal_certification(_user_id UUID, _portal TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.training_modules m
    LEFT JOIN public.training_progress p
      ON p.module_id = m.id AND p.agent_id = _user_id
    WHERE m.is_active = true
      AND m.is_mandatory = true
      AND (m.portal = _portal OR m.portal = 'both')
      AND (p.status IS DISTINCT FROM 'completed' OR p.score < m.passing_score)
  );
$$;