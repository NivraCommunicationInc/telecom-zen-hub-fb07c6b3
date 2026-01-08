-- ============================================
-- FIX: Security Definer View errors
-- Convert views to SECURITY INVOKER (default) pattern
-- ============================================

-- Drop and recreate views without SECURITY DEFINER
DROP VIEW IF EXISTS public.site_offers_public;
DROP VIEW IF EXISTS public.site_settings_public;

-- Recreate as SECURITY INVOKER views (explicit)
CREATE VIEW public.site_offers_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  offer_type,
  category,
  name_fr,
  name_en,
  description_fr,
  description_en,
  price_monthly,
  price_setup,
  discount_percent,
  discount_amount,
  promo_code,
  valid_from,
  valid_until,
  is_featured,
  features_json,
  sort_order
FROM public.site_offers
WHERE is_active = true
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until >= now());

CREATE VIEW public.site_settings_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  key,
  value_text,
  value_json,
  description,
  category
FROM public.site_settings
WHERE is_public = true;

-- Re-grant access
GRANT SELECT ON public.site_offers_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- For anon users to access through views, we need RLS policies on the base tables
-- that allow the view to function properly
CREATE POLICY "Anon read active offers via view" 
ON public.site_offers 
FOR SELECT 
TO anon
USING (
  is_active = true 
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until >= now())
);

CREATE POLICY "Anon read public settings via view" 
ON public.site_settings 
FOR SELECT 
TO anon
USING (is_public = true);

-- Add comments
COMMENT ON VIEW public.site_offers_public IS 'Secure public view of active offers without internal metadata (SECURITY INVOKER)';
COMMENT ON VIEW public.site_settings_public IS 'Secure public view of public settings without internal metadata (SECURITY INVOKER)';