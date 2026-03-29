ALTER TABLE public.sales_commissions DROP CONSTRAINT IF EXISTS sales_commissions_status_check;

ALTER TABLE public.sales_commissions ADD CONSTRAINT sales_commissions_status_check 
  CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'pending_activation'::text, 
    'validated'::text, 
    'payable'::text, 
    'included_in_payroll'::text, 
    'paid'::text, 
    'rejected'::text, 
    'clawback'::text, 
    'cancelled'::text
  ]));