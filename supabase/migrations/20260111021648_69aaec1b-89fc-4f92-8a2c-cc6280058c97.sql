-- Fix the security definer view issue
DROP VIEW IF EXISTS public.client_payment_history;
CREATE VIEW public.client_payment_history 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  COALESCE(p.client_id, p.user_id) AS client_id,
  p.invoice_id,
  p.billing_id,
  p.order_id,
  p.amount,
  p.payment_method,
  p.reference_number,
  p.status,
  p.source,
  p.captured_at,
  p.created_at,
  p.created_by_name,
  p.created_by_role,
  b.invoice_number,
  b.balance_due AS invoice_balance_due,
  b.status AS invoice_status
FROM public.payments p
LEFT JOIN public.billing b ON b.id = COALESCE(p.invoice_id, p.billing_id)
ORDER BY p.created_at DESC;