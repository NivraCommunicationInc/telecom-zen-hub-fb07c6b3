-- =====================================================
-- SECURITY FIX: Create secure public views
-- =====================================================

-- 1. Create public view for referral_codes (hide usage_count and influencer_id)
DROP VIEW IF EXISTS public.referral_codes_public;
CREATE VIEW public.referral_codes_public
WITH (security_invoker=on) AS
SELECT 
  id,
  code,
  status
FROM public.referral_codes
WHERE status = 'active';

-- Grant access to public view
GRANT SELECT ON public.referral_codes_public TO anon, authenticated;

-- 2. Create public view for site_offers (hide internal metadata like created_by, updated_by)
DROP VIEW IF EXISTS public.site_offers_public;
CREATE VIEW public.site_offers_public
WITH (security_invoker=on) AS
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
  is_active,
  is_featured,
  features_json,
  sort_order,
  created_at
FROM public.site_offers
WHERE is_active = true 
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until > now());

-- Grant access to public view
GRANT SELECT ON public.site_offers_public TO anon, authenticated;