
-- Add contract_pdf_url column to contracts table if not exists
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;

-- Add contract_pdf_generated_at column for tracking
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS contract_pdf_stored_at TIMESTAMP WITH TIME ZONE;

-- Create view for unified client list (profiles + billing_customers)
CREATE OR REPLACE VIEW public.unified_clients AS
SELECT 
  p.id,
  p.user_id,
  p.email,
  p.full_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.created_at,
  p.client_number,
  p.service_address,
  p.service_city,
  p.service_postal_code,
  p.service_province,
  p.date_of_birth,
  p.sector_tags,
  'profile' as source,
  true as has_profile,
  EXISTS(SELECT 1 FROM billing_customers bc WHERE lower(trim(bc.email)) = lower(trim(p.email))) as has_billing_customer,
  (SELECT a.account_number FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) as account_number,
  (SELECT a.status FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) as account_status
FROM profiles p
UNION
SELECT 
  bc.id,
  bc.user_id,
  bc.email,
  bc.first_name || ' ' || bc.last_name as full_name,
  bc.first_name,
  bc.last_name,
  bc.phone,
  bc.created_at,
  null as client_number,
  null as service_address,
  null as service_city,
  null as service_postal_code,
  null as service_province,
  null as date_of_birth,
  null as sector_tags,
  'billing' as source,
  EXISTS(SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = lower(trim(bc.email))) as has_profile,
  true as has_billing_customer,
  null as account_number,
  null as account_status
FROM billing_customers bc
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = lower(trim(bc.email))
);

-- Grant select on the view
GRANT SELECT ON public.unified_clients TO authenticated;
GRANT SELECT ON public.unified_clients TO anon;
