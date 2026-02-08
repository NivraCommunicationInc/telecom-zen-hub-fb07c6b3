
-- Fix search_clients_unified to use correct column names in orders table
DROP FUNCTION IF EXISTS public.search_clients_unified(text, text, text);

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
      AND (norm_name = '' OR lower(COALESCE(p.full_name, '')) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

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
      AND (norm_phone = '' OR regexp_replace(COALESCE(bc.phone, ''), '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

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
      AND (norm_name = '' OR lower(COALESCE(bi.billing_snapshot_client->>'full_name', '')) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(COALESCE(bi.billing_snapshot_client->>'phone', ''), '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')

    UNION ALL

    -- Orders (use client_first_name + client_last_name)
    SELECT DISTINCT
      'orders'::text as src,
      o.user_id as src_id,
      lower(trim(o.client_email)) as em,
      CONCAT(o.client_first_name, ' ', o.client_last_name) as nm,
      o.phone as ph,
      o.created_at as ca
    FROM orders o
    WHERE (norm_email = '' OR lower(trim(COALESCE(o.client_email, ''))) LIKE '%' || norm_email || '%')
      AND (norm_name = '' OR lower(CONCAT(COALESCE(o.client_first_name, ''), ' ', COALESCE(o.client_last_name, ''))) LIKE '%' || norm_name || '%')
      AND (norm_phone = '' OR regexp_replace(COALESCE(o.phone, ''), '[^0-9]', '', 'g') LIKE '%' || norm_phone || '%')
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

GRANT EXECUTE ON FUNCTION public.search_clients_unified TO authenticated;
