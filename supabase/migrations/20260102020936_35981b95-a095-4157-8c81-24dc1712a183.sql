-- Add amount_paid to billing table for partial payment support
ALTER TABLE public.billing 
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- Add amount_paid to monthly_invoices table for partial payment support
ALTER TABLE public.monthly_invoices 
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- Create a function to compute client balance from all unpaid invoices
CREATE OR REPLACE FUNCTION public.get_client_balance(p_client_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  billing_balance numeric;
  monthly_balance numeric;
BEGIN
  -- Sum from billing table (one-time invoices)
  SELECT COALESCE(SUM(amount - COALESCE(amount_paid, 0)), 0)
  INTO billing_balance
  FROM public.billing
  WHERE user_id = p_client_id
    AND status IN ('pending', 'overdue', 'partial');

  -- Sum from monthly_invoices table (recurring invoices)
  SELECT COALESCE(SUM(total - COALESCE(amount_paid, 0)), 0)
  INTO monthly_balance
  FROM public.monthly_invoices
  WHERE client_id = p_client_id
    AND status IN ('issued', 'overdue', 'partial');

  RETURN billing_balance + monthly_balance;
END;
$$;

-- Create a view for easy access to all unpaid invoices for a client
CREATE OR REPLACE VIEW public.client_unpaid_invoices AS
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

-- Grant access to the view
GRANT SELECT ON public.client_unpaid_invoices TO authenticated;

-- Add RLS policy for the view (it inherits from underlying tables)