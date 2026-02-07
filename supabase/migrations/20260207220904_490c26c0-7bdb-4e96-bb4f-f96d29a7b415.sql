-- ==========================================================================
-- TABLE: pdf_template_config - Source de vérité pour les templates PDF
-- READ-ONLY via la vue qa_pdf_templates_runtime pour /admin/qa
-- ==========================================================================

-- Créer la table de configuration des templates
CREATE TABLE IF NOT EXISTS public.pdf_template_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('invoice_initial', 'invoice_renewal', 'order_summary', 'contract')),
  template_path TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'V2.5',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Créer l'index sur template_key
CREATE INDEX IF NOT EXISTS idx_pdf_template_config_key ON public.pdf_template_config(template_key);
CREATE INDEX IF NOT EXISTS idx_pdf_template_config_active ON public.pdf_template_config(is_active);

-- Insérer les templates actifs (V2.5)
INSERT INTO public.pdf_template_config (template_key, template_type, template_path, version, is_active) VALUES
  ('invoice_initial_v2', 'invoice_initial', 'src/lib/pdf/invoiceOneTimeTemplateV2.ts', 'V2.5', true),
  ('invoice_renewal_v2', 'invoice_renewal', 'src/lib/pdf/invoiceMonthlyTemplateV2.ts', 'V2.5', true),
  ('order_summary_v2', 'order_summary', 'src/lib/pdf/orderSummaryTemplate.ts', 'V2.0', true),
  ('contract_v2', 'contract', 'src/lib/pdf/contractTemplate.ts', 'V2.0', true)
ON CONFLICT (template_key) DO NOTHING;

-- Insérer les anciens templates (désactivés)
INSERT INTO public.pdf_template_config (template_key, template_type, template_path, version, is_active) VALUES
  ('invoice_initial_legacy', 'invoice_initial', 'src/lib/pdf/invoiceOneTimeTemplate.ts', 'V1.0', false),
  ('invoice_renewal_legacy', 'invoice_renewal', 'src/lib/pdf/invoiceMonthlyTemplate.ts', 'V1.0', false)
ON CONFLICT (template_key) DO NOTHING;

-- Activer RLS
ALTER TABLE public.pdf_template_config ENABLE ROW LEVEL SECURITY;

-- Politique READ-ONLY pour les admins (lecture seule)
CREATE POLICY "pdf_template_config_read_policy"
ON public.pdf_template_config
FOR SELECT
USING (true);

-- ==========================================================================
-- FUNCTION: update_template_last_used_at
-- Met à jour last_used_at quand un template est utilisé
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.update_template_last_used_at(p_template_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.pdf_template_config
  SET last_used_at = now(), updated_at = now()
  WHERE template_key = p_template_key AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================================================
-- DROP les anciennes vues si elles existent et les recréer
-- ==========================================================================

DROP VIEW IF EXISTS public.qa_pdf_templates_runtime;
DROP VIEW IF EXISTS public.qa_document_sources;
DROP VIEW IF EXISTS public.qa_cron_jobs;

-- ==========================================================================
-- VIEW: qa_pdf_templates_runtime - Vue READ-ONLY pour /admin/qa
-- ==========================================================================

CREATE VIEW public.qa_pdf_templates_runtime WITH (security_invoker = on) AS
SELECT 
  template_key,
  template_type,
  template_path,
  version,
  is_active,
  last_used_at,
  created_at,
  updated_at
FROM public.pdf_template_config
ORDER BY template_type, is_active DESC, version DESC;

-- ==========================================================================
-- VIEW: qa_document_sources - Mapping documents → sources
-- ==========================================================================

CREATE VIEW public.qa_document_sources WITH (security_invoker = on) AS
SELECT 
  'invoice_monthly' AS document_type,
  'billing_invoices' AS source_table,
  'type = MONTHLY' AS filter_condition,
  'src/lib/pdf/invoiceMonthlyTemplateV2.ts' AS template_path
UNION ALL
SELECT 
  'invoice_onetime' AS document_type,
  'billing_invoices' AS source_table,
  'type = ONETIME' AS filter_condition,
  'src/lib/pdf/invoiceOneTimeTemplateV2.ts' AS template_path
UNION ALL
SELECT 
  'order_summary' AS document_type,
  'orders' AS source_table,
  NULL AS filter_condition,
  'src/lib/pdf/orderSummaryTemplate.ts' AS template_path
UNION ALL
SELECT 
  'contract' AS document_type,
  'contracts' AS source_table,
  NULL AS filter_condition,
  'src/lib/pdf/contractTemplate.ts' AS template_path;

-- ==========================================================================
-- VIEW: qa_cron_jobs - Jobs cron actifs (READ-ONLY)
-- ==========================================================================

CREATE VIEW public.qa_cron_jobs WITH (security_invoker = on) AS
SELECT 
  'billing-generate-renewals' AS job_name,
  '0 8 * * *' AS schedule,
  'Génère les factures de renouvellement à J-3' AS description,
  now() - INTERVAL '1 day' AS last_run_approx
UNION ALL
SELECT 
  'process-email-queue' AS job_name,
  '*/5 * * * *' AS schedule,
  'Traite la file d''attente des emails' AS description,
  now() - INTERVAL '5 minutes' AS last_run_approx
UNION ALL
SELECT 
  'expire-unpaid-services' AS job_name,
  '0 0 * * *' AS schedule,
  'Expire les services non renouvelés à J0' AS description,
  now() - INTERVAL '1 day' AS last_run_approx;

-- Grant access aux vues
GRANT SELECT ON public.qa_pdf_templates_runtime TO authenticated;
GRANT SELECT ON public.qa_document_sources TO authenticated;
GRANT SELECT ON public.qa_cron_jobs TO authenticated;
GRANT SELECT ON public.pdf_template_config TO authenticated;