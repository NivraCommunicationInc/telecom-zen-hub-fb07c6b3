
-- ============================================================
-- UNIFIED CLIENT SEARCH & QA SYSTEM
-- Enables searching across all client data sources
-- ============================================================

-- 1) Create a unified client search function
-- Searches across profiles, billing_customers, accounts, order_snapshots, billing_invoices
CREATE OR REPLACE FUNCTION public.search_clients_unified(search_email text DEFAULT NULL, search_name text DEFAULT NULL, search_phone text DEFAULT NULL)
RETURNS TABLE(
  source text,
  source_id uuid,
  email text,
  full_name text,
  phone text,
  created_at timestamptz,
  has_profile boolean,
  has_billing_customer boolean,
  has_account boolean,
  has_invoices boolean,
  has_orders boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_email text;
  norm_name text;
  norm_phone text;
BEGIN
  -- Normalize inputs
  norm_email := lower(trim(COALESCE(search_email, '')));
  norm_name := lower(trim(COALESCE(search_name, '')));
  norm_phone := regexp_replace(COALESCE(search_phone, ''), '[^0-9]', '', 'g');

  RETURN QUERY
  WITH all_sources AS (
    -- Profiles
    SELECT 
      'profiles'::text as src,
      p.user_id as src_id,
      lower(trim(p.email)) as em,
      p.full_name as nm,
      p.phone as ph,
      p.created_at as ca
    FROM profiles p
    WHERE (norm_email = '' OR lower(trim(p.email)) LIKE '%' || norm_email || '%')
      AND (norm_name = '' OR lower(p.full_name) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(p.phone, '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

    UNION ALL

    -- Billing customers
    SELECT 
      'billing_customers'::text as src,
      bc.id as src_id,
      lower(trim(bc.email)) as em,
      CONCAT(bc.first_name, ' ', bc.last_name) as nm,
      bc.phone as ph,
      bc.created_at as ca
    FROM billing_customers bc
    WHERE (norm_email = '' OR lower(trim(bc.email)) LIKE '%' || norm_email || '%')
      AND (norm_name = '' OR lower(CONCAT(bc.first_name, ' ', bc.last_name)) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(bc.phone, '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

    UNION ALL

    -- Billing invoices (snapshot)
    SELECT DISTINCT
      'billing_invoices'::text as src,
      bi.customer_id as src_id,
      lower(trim(bi.billing_snapshot_client->>'email')) as em,
      bi.billing_snapshot_client->>'full_name' as nm,
      bi.billing_snapshot_client->>'phone' as ph,
      bi.created_at as ca
    FROM billing_invoices bi
    WHERE bi.billing_snapshot_client IS NOT NULL
      AND (norm_email = '' OR lower(trim(bi.billing_snapshot_client->>'email')) LIKE '%' || norm_email || '%')
      AND (norm_name = '' OR lower(bi.billing_snapshot_client->>'full_name') LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(bi.billing_snapshot_client->>'phone', '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

    UNION ALL

    -- Orders (client snapshot in orders)
    SELECT DISTINCT
      'orders'::text as src,
      o.user_id as src_id,
      lower(trim(o.client_email)) as em,
      o.full_name as nm,
      o.phone as ph,
      o.created_at as ca
    FROM orders o
    WHERE (norm_email = '' OR lower(trim(o.client_email)) LIKE '%' || norm_email || '%')
      AND (norm_name = '' OR lower(o.full_name) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(o.phone, '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')
  ),
  -- Deduplicate by email
  deduped AS (
    SELECT DISTINCT ON (em)
      src as source,
      src_id as source_id,
      em as email,
      nm as full_name,
      ph as phone,
      ca as created_at
    FROM all_sources
    WHERE em IS NOT NULL AND em != ''
    ORDER BY em, 
      CASE src 
        WHEN 'profiles' THEN 1 
        WHEN 'billing_customers' THEN 2 
        ELSE 3 
      END,
      ca DESC
  )
  SELECT 
    d.source,
    d.source_id,
    d.email,
    d.full_name,
    d.phone,
    d.created_at,
    EXISTS(SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = d.email) as has_profile,
    EXISTS(SELECT 1 FROM billing_customers bc WHERE lower(trim(bc.email)) = d.email) as has_billing_customer,
    EXISTS(SELECT 1 FROM accounts a JOIN profiles p2 ON a.client_id = p2.user_id WHERE lower(trim(p2.email)) = d.email) as has_account,
    EXISTS(SELECT 1 FROM billing_invoices bi WHERE lower(trim(bi.billing_snapshot_client->>'email')) = d.email) as has_invoices,
    EXISTS(SELECT 1 FROM orders o WHERE lower(trim(o.client_email)) = d.email) as has_orders
  FROM deduped d
  ORDER BY d.created_at DESC
  LIMIT 100;
END;
$$;

-- 2) Create QA view for orphaned payments (payments without linked client profile)
CREATE OR REPLACE VIEW public.qa_orphaned_payments AS
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

-- 3) Create view for payments without any client entity
CREATE OR REPLACE VIEW public.qa_payments_without_client AS
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
  COALESCE(bi.billing_snapshot_client->>'full_name', CONCAT(bc.first_name, ' ', bc.last_name))
ORDER BY total_paid DESC;

-- 4) Grant access
GRANT EXECUTE ON FUNCTION public.search_clients_unified TO authenticated;
GRANT SELECT ON public.qa_orphaned_payments TO authenticated;
GRANT SELECT ON public.qa_payments_without_client TO authenticated;
