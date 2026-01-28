-- ============================================
-- SECURITY FIX: Protect influencer invite tokens
-- ============================================

-- 1. Drop the dangerous public policy that exposes tokens
DROP POLICY IF EXISTS "Public can validate invite tokens" ON public.influencer_invites;

-- 2. Drop existing views if they exist, then create new ones
DROP VIEW IF EXISTS public.influencer_invites_public CASCADE;
DROP VIEW IF EXISTS public.site_offers_public CASCADE;
DROP VIEW IF EXISTS public.services_public CASCADE;
DROP VIEW IF EXISTS public.streaming_catalog_public CASCADE;

-- 3. Create a safe public view for influencer invites that does NOT expose the token
CREATE VIEW public.influencer_invites_public
WITH (security_invoker = on) AS
SELECT 
  id,
  expires_at,
  used_at IS NOT NULL AS is_used,
  (expires_at > now()) AND (used_at IS NULL) AS is_valid
FROM public.influencer_invites;

GRANT SELECT ON public.influencer_invites_public TO anon, authenticated;

-- ============================================
-- PUBLIC VIEWS: Limited exposure for business data
-- ============================================

-- 4. Create safe public view for site_offers (customer-facing fields only)
-- Hides: promo_code, created_by_*, updated_by_*, internal audit fields
CREATE VIEW public.site_offers_public
WITH (security_invoker = on) AS
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
  is_featured,
  features_json,
  sort_order
FROM public.site_offers
WHERE is_active = true 
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until >= now());

GRANT SELECT ON public.site_offers_public TO anon, authenticated;

-- 5. Create safe public view for services (customer-facing fields only)
CREATE VIEW public.services_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  description,
  category,
  price,
  billing_type
FROM public.services
WHERE is_active = true;

GRANT SELECT ON public.services_public TO anon, authenticated;

-- 6. Create safe public view for streaming_catalog (customer-facing fields only)
CREATE VIEW public.streaming_catalog_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  category,
  description,
  price_monthly,
  currency,
  features,
  sort_order,
  logo_url
FROM public.streaming_catalog
WHERE status = 'active';

GRANT SELECT ON public.streaming_catalog_public TO anon, authenticated;

-- ============================================
-- UPDATE RLS: Remove overly permissive policies
-- ============================================

-- Drop the public anon policy on streaming_catalog that exposes all data
DROP POLICY IF EXISTS "Public can view active streaming catalog" ON public.streaming_catalog;