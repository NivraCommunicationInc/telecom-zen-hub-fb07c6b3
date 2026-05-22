
-- ============================================================
-- DIRECTORY SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.directory_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_name TEXT NOT NULL,
  directory_url TEXT NOT NULL,
  submission_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','verified','rejected','to_update')),
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  listing_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.directory_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "directory_submissions_admin_all" ON public.directory_submissions;
CREATE POLICY "directory_submissions_admin_all" ON public.directory_submissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.directory_submissions (directory_name, directory_url, submission_url, status) VALUES
('Pages Jaunes Canada','https://www.pagesjaunes.ca','https://www.pagesjaunes.ca/advertise','pending'),
('Yelp Canada','https://www.yelp.ca','https://biz.yelp.ca/claiming/signup','pending'),
('Canada411','https://www.canada411.ca','https://www.canada411.ca/business/add','pending'),
('YP.ca','https://www.yp.ca','https://www.yp.ca/advertise','pending'),
('Better Business Bureau','https://www.bbb.org','https://www.bbb.org/ca/on/toronto/accreditation','pending'),
('Chambre de Commerce Montréal','https://www.ccmm.ca','https://www.ccmm.ca/en/membership/','pending'),
('Hotfrog Canada','https://www.hotfrog.ca','https://www.hotfrog.ca/AddBusiness.aspx','pending'),
('Cylex Canada','https://ca.cylex.com','https://ca.cylex.com/en/add-company.html','pending'),
('Tupalo','https://tupalo.com','https://tupalo.com/en/businesses/new','pending'),
('EZlocal','https://ezlocal.com','https://ezlocal.com/claim','pending')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SOCIAL MEDIA POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'both'
    CHECK (platform IN ('facebook','instagram','both')),
  post_text TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}'::TEXT[],
  post_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','published','rejected')),
  generated_by TEXT DEFAULT 'nova',
  approved_by UUID,
  published_at TIMESTAMPTZ,
  facebook_post_id TEXT,
  reach INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_media_posts_admin_all" ON public.social_media_posts;
CREATE POLICY "social_media_posts_admin_all" ON public.social_media_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- REGISTER 6 NEW AGENTS
-- ============================================================
INSERT INTO public.agent_registry (agent_name, display_name, description, function_name, cron_schedule, cron_job_name) VALUES
('crm-email-blast','Email Blast CRM','Envoie des emails promotionnels personnalisés aux prospects avec email dans le CRM','agent-crm-email-blast','0 10 * * *','agent-crm-email-blast'),
('google-ads-monitor','Google Ads Monitor','Surveille les campagnes Google Ads, détecte les annonces rejetées, optimise le budget','agent-google-ads','0 */6 * * *','agent-google-ads'),
('seo-monitor','SEO Monitor','Surveille l''indexation Google, vitesse des pages, et optimisation SEO','agent-seo','0 6 * * *','agent-seo-daily'),
('directories','Directories Gratuits','Gère les soumissions dans les répertoires en ligne gratuits pour améliorer la visibilité locale','agent-directories','0 9 * * 1','agent-directories-weekly'),
('social-media','Réseaux Sociaux','Génère des posts Facebook et Instagram 3x par semaine avec les vraies offres Nivra','agent-social','0 12 * * 1,3,5','agent-social-media'),
('followup','Follow-up Automatique','Relance automatiquement les prospects intéressés après 14 jours sans contact','agent-followup','0 14 * * *','agent-followup-daily')
ON CONFLICT (agent_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  function_name = EXCLUDED.function_name,
  cron_schedule = EXCLUDED.cron_schedule,
  cron_job_name = EXCLUDED.cron_job_name,
  updated_at = now();
