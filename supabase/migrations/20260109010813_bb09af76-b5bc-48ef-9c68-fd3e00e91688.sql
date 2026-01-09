-- Fix security definer view issue by setting INVOKER (caller's permissions)
-- The view should use the caller's RLS context, not the creator's

DROP VIEW IF EXISTS public.payment_requests_admin_view;

CREATE VIEW public.payment_requests_admin_view
WITH (security_invoker = true)
AS
SELECT 
  pr.*,
  p.email AS client_email,
  p.full_name AS client_name,
  p.phone AS client_phone,
  a.account_number,
  a.status AS account_status
FROM public.payment_requests pr
LEFT JOIN public.profiles p ON pr.user_id = p.user_id
LEFT JOIN public.accounts a ON a.client_id = pr.user_id;