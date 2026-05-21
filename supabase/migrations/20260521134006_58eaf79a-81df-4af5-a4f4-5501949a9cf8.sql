
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  function_name TEXT NOT NULL,
  cron_schedule TEXT,
  cron_job_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','error','disabled')),
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  avg_execution_ms INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL REFERENCES public.agent_registry(agent_name) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT CHECK (status IN ('running','success','failed','timeout','skipped')),
  actions_taken INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  summary TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  gemini_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('info','success','warning','error','critical','action','gemini_call','email_sent','auto_fix','escalation')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_started ON public.agent_runs(agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_created ON public.agent_events(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_created ON public.agent_events(created_at DESC);

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_registry_admin_all" ON public.agent_registry
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agent_runs_admin_all" ON public.agent_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agent_events_admin_all" ON public.agent_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_agent_registry_updated
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.agent_registry (agent_name, display_name, description, function_name, cron_schedule, cron_job_name) VALUES
('site-monitor','Surveillance Site','Scans toutes les 10 min pour bugs et erreurs','agent-site-monitor','*/10 * * * *','agent-site-monitor'),
('analytics','Analytics IA','Rapports quotidiens et hebdomadaires','agent-analytics','0 8 * * *','agent-analytics-daily'),
('marketing','Marketing & Promotions','Campagnes email personnalisées','agent-marketing','0 18 * * 0','agent-marketing-weekly'),
('billing','Facturation Auto','Rappels paiements et gestion overdue','agent-billing','0 * * * *','agent-billing-hourly'),
('retention','Rétention Clients','Détecte clients à risque et envoie offres','agent-retention','0 9 * * *','agent-retention-daily'),
('support','Support Client IA','Répond aux emails clients automatiquement','agent-support','*/5 * * * *','agent-support-check'),
('crm-optimizer','CRM Prosper','Optimise la liste de contacts toutes les nuits','agent-crm-optimizer','0 2 * * *','agent-crm-optimizer'),
('recruitment','Recrutement Auto','Gère le pipeline de candidatures','agent-recruitment','0 */6 * * *','agent-recruitment'),
('sales','Ventes Automatique','Détecte opportunités upsell/cross-sell','agent-sales','0 11 * * *','agent-sales-daily'),
('sync','Synchronisation','Vérifie sync des commandes et données','agent-sync','*/30 * * * *','agent-sync'),
('supervisor','Superviseur des Agents','Surveille et supervise tous les agents IA','agent-supervisor','*/15 * * * *','agent-supervisor'),
('sales-assignment','Assignation des Ventes','Vérifie et assigne toutes les ventes aux bons agents avec commissions','agent-sales-assignment','*/15 * * * *','agent-sales-assignment')
ON CONFLICT (agent_name) DO NOTHING;

DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_registry';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_events';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.agent_registry REPLICA IDENTITY FULL;
ALTER TABLE public.agent_runs REPLICA IDENTITY FULL;
ALTER TABLE public.agent_events REPLICA IDENTITY FULL;
