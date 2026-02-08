
-- Fix security definer views - convert to security invoker
DROP VIEW IF EXISTS public.qa_orphaned_payments;
DROP VIEW IF EXISTS public.qa_payments_without_client;

-- Recreate with SECURITY INVOKER (default, explicit for clarity)
CREATE VIEW public.qa_orphaned_payments 
WITH (security_invoker = true)
AS
SELECT 
  bi.id as invoice_id,
  bi.invoice_number,
  bi.total as invoice_total,
  bi.status as invoice_status,
  bi.created_at as invoice_created_at,
  bi.billing_snapshot_client->>'email' as customer_email,
  bi.billing_snapshot_client->>'full_name' as customer_name,
  bc.id as billing_customer_id,
  bc.email as bc_email,
  p.user_id as profile_user_id,
  p.email as profile_email,
  CASE 
    WHEN p.user_id IS NULL THEN 'NO_PROFILE'
    WHEN bc.id IS NULL THEN 'NO_BILLING_CUSTOMER'
    ELSE 'LINKED'
  END as link_status
FROM billing_invoices bi
LEFT JOIN billing_customers bc ON bi.customer_id = bc.id
LEFT JOIN profiles p ON lower(trim(p.email)) = lower(trim(bc.email))
WHERE bi.status = 'paid'
  AND (p.user_id IS NULL OR bc.id IS NULL);

CREATE VIEW public.qa_payments_without_client 
WITH (security_invoker = true)
AS
SELECT DISTINCT 
  COALESCE(bi.billing_snapshot_client->>'email', bc.email) as email,
  COALESCE(bi.billing_snapshot_client->>'full_name', CONCAT(bc.first_name, ' ', bc.last_name)) as full_name,
  COUNT(DISTINCT bi.id) as invoice_count,
  SUM(bi.total) as total_invoiced,
  SUM(CASE WHEN bi.status = 'paid' THEN bi.total ELSE 0 END) as total_paid,
  MAX(bi.created_at) as last_invoice_at
FROM billing_invoices bi
LEFT JOIN billing_customers bc ON bi.customer_id = bc.id
LEFT JOIN profiles p ON lower(trim(p.email)) = lower(trim(COALESCE(bi.billing_snapshot_client->>'email', bc.email)))
WHERE p.user_id IS NULL
  AND COALESCE(bi.billing_snapshot_client->>'email', bc.email) IS NOT NULL
GROUP BY 
  COALESCE(bi.billing_snapshot_client->>'email', bc.email),
  COALESCE(bi.billing_snapshot_client->>'full_name', CONCAT(bc.first_name, ' ', bc.last_name));

-- Grant access
GRANT SELECT ON public.qa_orphaned_payments TO authenticated;
GRANT SELECT ON public.qa_payments_without_client TO authenticated;
