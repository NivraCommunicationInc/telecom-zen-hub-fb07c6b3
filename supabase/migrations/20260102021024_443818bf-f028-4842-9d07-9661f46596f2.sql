-- Drop the view and recreate it without security definer
DROP VIEW IF EXISTS public.client_unpaid_invoices;

-- Recreate the view as SECURITY INVOKER (default, no explicit setting needed)
CREATE VIEW public.client_unpaid_invoices AS
SELECT 
  'billing' as source_table,
  id,
  user_id as client_id,
  invoice_number,
  NULL::date as period_start,
  NULL::date as period_end,
  created_at::date as issue_date,
  due_date,
  status,
  amount as total,
  COALESCE(amount_paid, 0) as amount_paid,
  amount - COALESCE(amount_paid, 0) as amount_due,
  related_order_number as description
FROM public.billing
WHERE status IN ('pending', 'overdue', 'partial')
UNION ALL
SELECT 
  'monthly_invoices' as source_table,
  id,
  client_id,
  invoice_number,
  period_start,
  period_end,
  issue_date,
  due_date,
  status,
  total,
  COALESCE(amount_paid, 0) as amount_paid,
  total - COALESCE(amount_paid, 0) as amount_due,
  'Facture mensuelle' as description
FROM public.monthly_invoices
WHERE status IN ('issued', 'overdue', 'partial');

-- Grant access
GRANT SELECT ON public.client_unpaid_invoices TO authenticated;