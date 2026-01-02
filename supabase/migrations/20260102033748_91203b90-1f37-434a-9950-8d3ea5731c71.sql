
-- ============================================
-- SECURITY FIX F: Recreate views with SECURITY INVOKER (explicit)
-- ============================================

-- Drop and recreate client_unpaid_invoices with explicit security invoker
DROP VIEW IF EXISTS public.client_unpaid_invoices;

CREATE VIEW public.client_unpaid_invoices
WITH (security_invoker = true)
AS
SELECT 
  'billing'::text AS source_table,
  billing.id,
  billing.user_id AS client_id,
  billing.invoice_number,
  NULL::date AS period_start,
  NULL::date AS period_end,
  (billing.created_at)::date AS issue_date,
  billing.due_date,
  billing.status,
  billing.amount AS total,
  COALESCE(billing.amount_paid, (0)::numeric) AS amount_paid,
  (billing.amount - COALESCE(billing.amount_paid, (0)::numeric)) AS amount_due,
  billing.related_order_number AS description
FROM billing
WHERE billing.status = ANY (ARRAY['pending'::text, 'overdue'::text, 'partial'::text])
UNION ALL
SELECT 
  'monthly_invoices'::text AS source_table,
  monthly_invoices.id,
  monthly_invoices.client_id,
  monthly_invoices.invoice_number,
  monthly_invoices.period_start,
  monthly_invoices.period_end,
  monthly_invoices.issue_date,
  monthly_invoices.due_date,
  monthly_invoices.status,
  monthly_invoices.total,
  COALESCE(monthly_invoices.amount_paid, (0)::numeric) AS amount_paid,
  (monthly_invoices.total - COALESCE(monthly_invoices.amount_paid, (0)::numeric)) AS amount_due,
  'Facture mensuelle'::text AS description
FROM monthly_invoices
WHERE monthly_invoices.status = ANY (ARRAY['issued'::text, 'overdue'::text, 'partial'::text]);

-- Drop and recreate tv_channels_public with explicit security invoker
DROP VIEW IF EXISTS public.tv_channels_public;

CREATE VIEW public.tv_channels_public
WITH (security_invoker = true)
AS
SELECT 
  id, 
  name, 
  category, 
  description, 
  is_hd, 
  is_4k, 
  is_active,
  status,
  incident_type,
  incident_reason,
  incident_at,
  replacement_channel_id,
  created_at,
  updated_at
FROM public.tv_channels
WHERE is_active = true;

-- Re-grant access to the view
GRANT SELECT ON public.tv_channels_public TO anon, authenticated;
GRANT SELECT ON public.client_unpaid_invoices TO authenticated;
