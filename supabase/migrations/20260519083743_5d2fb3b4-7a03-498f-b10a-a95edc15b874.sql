
-- Whitelist table
CREATE TABLE IF NOT EXISTS public.training_certification_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'Test / Pilot account',
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_certification_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_whitelist_read ON public.training_certification_whitelist;
CREATE POLICY p_whitelist_read ON public.training_certification_whitelist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS p_whitelist_write ON public.training_certification_whitelist;
CREATE POLICY p_whitelist_write ON public.training_certification_whitelist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated cert check: whitelist bypass
CREATE OR REPLACE FUNCTION public.fn_check_portal_certification(_user_id uuid, _portal text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.training_certification_whitelist w WHERE w.user_id = _user_id)
    OR NOT EXISTS (
      SELECT 1
      FROM public.training_modules m
      LEFT JOIN public.training_progress p
        ON p.module_id = m.id AND p.agent_id = _user_id
      WHERE m.is_active = true
        AND m.is_mandatory = true
        AND (m.portal = _portal OR m.portal = 'both')
        AND (p.status IS DISTINCT FROM 'completed' OR p.score < m.passing_score)
    );
$function$;

-- Seed initial whitelist (Nivra Test Order + Sim Pilot)
INSERT INTO public.training_certification_whitelist (user_id, reason)
VALUES
  ('0de86553-853e-4ce2-9c87-86dd2ecb830d', 'Nivra Test Order — exempt from training gate'),
  ('f8d013de-5e19-4e91-844d-906b18f70b76', 'Sim Pilot — exempt from training gate')
ON CONFLICT (user_id) DO NOTHING;
