
CREATE TABLE IF NOT EXISTS public.site_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL CHECK (check_type IN ('email_queue','cron_jobs','database','security','performance','routes','storage','payments','api')),
  status TEXT NOT NULL CHECK (status IN ('ok','warning','critical','error')),
  title TEXT NOT NULL,
  description TEXT,
  details JSONB,
  auto_fixed BOOLEAN DEFAULT false,
  auto_fix_description TEXT,
  requires_attention BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_health_checks_created ON public.site_health_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_health_checks_status ON public.site_health_checks(status, resolved_at);

ALTER TABLE public.site_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read site_health_checks"
  ON public.site_health_checks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update site_health_checks"
  ON public.site_health_checks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE IF NOT EXISTS public.agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  result TEXT CHECK (result IN ('success','failure','warning','skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_created ON public.agent_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_agent ON public.agent_audit_log(agent_name, created_at DESC);

ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read agent_audit_log"
  ON public.agent_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE IF NOT EXISTS public.analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly','monthly','daily','custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL,
  ai_analysis TEXT,
  ai_recommendations JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  sent_to TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_generated ON public.analytics_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON public.analytics_reports(report_type, period_end DESC);

ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read analytics_reports"
  ON public.analytics_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
