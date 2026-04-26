-- 1. Extend jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS description_md text,
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- Auto-generate slug from title if missing
CREATE OR REPLACE FUNCTION public.generate_job_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(unaccent(coalesce(NEW.title, 'job')), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.jobs WHERE slug = final_slug AND id <> NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_slug_trigger ON public.jobs;
CREATE TRIGGER jobs_slug_trigger
  BEFORE INSERT OR UPDATE OF title ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_job_slug();

-- Backfill slugs for existing jobs
UPDATE public.jobs SET slug = NULL WHERE slug IS NULL;
UPDATE public.jobs SET title = title WHERE slug IS NULL;

-- 2. Extend job_applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score smallint CHECK (score IS NULL OR (score BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_job_applications_tags ON public.job_applications USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_job_applications_unread ON public.job_applications(created_at DESC) WHERE read_at IS NULL;

-- 3. Email templates per recruitment stage
CREATE TABLE IF NOT EXISTS public.job_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL CHECK (stage IN ('reviewing','interview','offer','hired','rejected','received')),
  language text NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','en')),
  subject text NOT NULL,
  body_md text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage, language)
);

ALTER TABLE public.job_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage job email templates" ON public.job_email_templates;
CREATE POLICY "Admins manage job email templates"
  ON public.job_email_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_job_email_templates_updated_at ON public.job_email_templates;
CREATE TRIGGER update_job_email_templates_updated_at
  BEFORE UPDATE ON public.job_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates (idempotent)
INSERT INTO public.job_email_templates (stage, language, subject, body_md, enabled) VALUES
('received', 'fr', 'Candidature reçue — {{position}}',
$$Bonjour {{name}},

Nous avons bien reçu votre candidature pour le poste de **{{position}}** chez Nivra Telecom.

Notre équipe va l'examiner attentivement. Si votre profil correspond à nos besoins, nous reviendrons vers vous dans les prochains jours.

Merci de votre intérêt pour Nivra.

L'équipe recrutement$$, true),
('interview', 'fr', 'Invitation à une entrevue — {{position}}',
$$Bonjour {{name}},

Suite à l''examen de votre candidature pour le poste de **{{position}}**, nous aimerions vous rencontrer en entrevue.

Date proposée : {{interview_date}}

Merci de confirmer votre disponibilité en répondant à ce courriel.

L'équipe recrutement Nivra$$, true),
('offer', 'fr', 'Offre d''emploi — {{position}}',
$$Bonjour {{name}},

Nous sommes ravis de vous offrir le poste de **{{position}}** au sein de Nivra Telecom.

Vous trouverez ci-joint l''offre détaillée. Merci de nous faire part de votre décision dans les meilleurs délais.

Au plaisir de vous compter parmi nous.

L'équipe recrutement Nivra$$, true),
('rejected', 'fr', 'Suivi de votre candidature — {{position}}',
$$Bonjour {{name}},

Nous vous remercions de l''intérêt que vous portez à Nivra Telecom et du temps consacré à votre candidature pour le poste de **{{position}}**.

Après étude attentive, nous avons retenu un autre profil correspondant davantage aux exigences spécifiques du poste.

{{reason}}

Nous conservons votre candidature dans notre base et reviendrons vers vous si une opportunité plus alignée se présente.

Bonne continuation dans vos démarches.

L'équipe recrutement Nivra$$, true)
ON CONFLICT (stage, language) DO NOTHING;

-- 4. Enable realtime on job_applications
ALTER TABLE public.job_applications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
  END IF;
END $$;

-- 5. RPC: increment job views (public)
CREATE OR REPLACE FUNCTION public.increment_job_views(_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs SET views_count = views_count + 1 WHERE slug = _slug AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_job_views(text) TO anon, authenticated;