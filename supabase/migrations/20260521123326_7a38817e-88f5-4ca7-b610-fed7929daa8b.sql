CREATE TABLE IF NOT EXISTS public.sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('order','ticket','complaint','plan_change','suspension','cancellation','crm_sale','profile')),
  source_portal TEXT CHECK (source_portal IN ('field','employee','client','core','crm','public')),
  record_id UUID NOT NULL,
  record_reference TEXT,
  sync_status TEXT DEFAULT 'ok' CHECK (sync_status IN ('ok','warning','missing_data','error','fixed')),
  issues_found JSONB DEFAULT '[]'::jsonb,
  auto_fixed BOOLEAN DEFAULT false,
  fix_description TEXT,
  requires_manual_review BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sync_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sync_audit_log" ON public.sync_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert sync_audit_log" ON public.sync_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update sync_audit_log" ON public.sync_audit_log
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete sync_audit_log" ON public.sync_audit_log
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_sync_audit_log_created_at ON public.sync_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_sync_type ON public.sync_audit_log (sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_status ON public.sync_audit_log (sync_status);