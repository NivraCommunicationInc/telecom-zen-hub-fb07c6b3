-- ===========================================================================
-- QA READ-ONLY VIEWS - Runtime audit data for /admin/qa
-- ===========================================================================

-- =====================================================
-- VIEW 1: qa_pdf_templates_runtime
-- Tracks active vs legacy PDF templates with real timestamps
-- =====================================================

CREATE OR REPLACE VIEW public.qa_pdf_templates_runtime AS

-- Active templates (derive last_used_at from actual documents)
SELECT
  'invoice_initial' AS type,
  'src/lib/pdfEngine/invoiceTemplateV2.ts' AS path,
  'V2.5' AS version,
  true AS active,
  (SELECT MAX(created_at) FROM public.billing_invoices WHERE type = 'initial') AS last_used_at

UNION ALL
SELECT
  'invoice_renewal' AS type,
  'src/lib/pdfEngine/invoiceTemplateV2.ts' AS path,
  'V2.5' AS version,
  true AS active,
  (SELECT MAX(created_at) FROM public.billing_invoices WHERE type = 'renewal') AS last_used_at

UNION ALL
SELECT
  'contract' AS type,
  'src/lib/pdfEngine/contractTemplateV2.ts' AS path,
  'V2.5' AS version,
  true AS active,
  (SELECT MAX(pdf_generated_at) FROM public.contracts) AS last_used_at

UNION ALL
SELECT
  'order_summary' AS type,
  'src/lib/pdfEngine/summaryTemplateV2.ts' AS path,
  'V2.5' AS version,
  true AS active,
  (SELECT MAX(created_at) FROM public.orders) AS last_used_at

UNION ALL
SELECT
  'terms' AS type,
  'src/lib/pdfEngine/termsModalitesPdfGenerator.ts' AS path,
  'V2.5' AS version,
  true AS active,
  NULL::timestamptz AS last_used_at

-- Legacy templates (always active=false)
UNION ALL
SELECT
  'invoice_legacy_v1' AS type,
  'src/lib/pdf/invoicePdfGenerator.ts' AS path,
  'V1.0' AS version,
  false AS active,
  NULL::timestamptz AS last_used_at

UNION ALL
SELECT
  'contract_legacy_v1' AS type,
  'src/lib/pdf/telecomContractGenerator.ts' AS path,
  'V1.0' AS version,
  false AS active,
  NULL::timestamptz AS last_used_at

UNION ALL
SELECT
  'invoice_monthly_v1' AS type,
  'src/lib/pdf/invoiceMonthlyTemplate.ts' AS path,
  'V1.0' AS version,
  false AS active,
  NULL::timestamptz AS last_used_at

UNION ALL
SELECT
  'invoice_onetime_v1' AS type,
  'src/lib/pdf/invoiceOneTimeTemplate.ts' AS path,
  'V1.0' AS version,
  false AS active,
  NULL::timestamptz AS last_used_at;


-- =====================================================
-- VIEW 2: qa_document_sources
-- Maps each document type to its database tables
-- =====================================================

CREATE OR REPLACE VIEW public.qa_document_sources AS
SELECT 'invoice_initial'::text AS document_type, 'billing_invoices'::text AS primary_table, NULL::text AS secondary_table
UNION ALL
SELECT 'invoice_renewal', 'billing_invoices', NULL
UNION ALL
SELECT 'contract', 'contracts', 'orders'
UNION ALL
SELECT 'order_summary', 'orders', 'equipment_details'
UNION ALL
SELECT 'terms', 'site_settings', NULL
UNION ALL
SELECT 'monthly_invoice', 'monthly_invoices', 'monthly_invoice_lines';


-- =====================================================
-- VIEW 3: qa_cron_jobs
-- READ-ONLY access to pg_cron job run details
-- =====================================================

CREATE OR REPLACE VIEW public.qa_cron_jobs AS
SELECT
  j.jobid AS job_id,
  j.jobname AS job_name,
  j.schedule,
  j.command,
  j.active,
  rd.runid AS last_run_id,
  rd.start_time AS last_run_at,
  rd.status AS last_run_status,
  rd.return_message AS last_run_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT runid, start_time, status, return_message
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) rd ON true
ORDER BY j.jobname;