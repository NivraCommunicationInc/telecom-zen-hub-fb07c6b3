
-- Add plan_code column to the services base table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS plan_code text;

-- Populate plan_codes for Internet
UPDATE public.services SET plan_code = 'internet_100' WHERE name = 'Internet 100 Mbps' AND category = 'Internet';
UPDATE public.services SET plan_code = 'internet_500' WHERE name = 'Internet 500 Mbps' AND category = 'Internet';
UPDATE public.services SET plan_code = 'internet_giga' WHERE name ILIKE '%Internet Giga%' AND category = 'Internet';

-- Populate plan_codes for Mobile
UPDATE public.services SET plan_code = 'mobile_50' WHERE name ILIKE '%Mobile 50GB%' AND category = 'Mobile';
UPDATE public.services SET plan_code = 'mobile_75' WHERE name ILIKE '%Mobile 75GB%' AND category = 'Mobile';
UPDATE public.services SET plan_code = 'mobile_talk_text' WHERE name ILIKE '%Talk & Text%' AND category = 'Mobile';

-- Populate plan_codes for TV combos (ux_only — decomposed at billing time)
UPDATE public.services SET plan_code = 'tv_basic' WHERE name ILIKE '%Internet 100 + TV Basic%' AND category = 'TV';
UPDATE public.services SET plan_code = 'tv_5choices' WHERE name ILIKE '%Internet 500 + TV 5%' AND category = 'TV';
UPDATE public.services SET plan_code = 'tv_10choices' WHERE name ILIKE '%Internet 500 + TV 10%' AND category = 'TV';
UPDATE public.services SET plan_code = 'tv_15choices' WHERE name ILIKE '%Internet 500 + TV 15%' AND category = 'TV';
UPDATE public.services SET plan_code = 'tv_25choices' WHERE name ILIKE '%Internet 500 + TV 25%' AND category = 'TV';
UPDATE public.services SET plan_code = 'giga_tv_basic' WHERE name ILIKE '%GIGA + TV Basic%' AND category = 'TV';
UPDATE public.services SET plan_code = 'giga_tv_5choices' WHERE name ILIKE '%GIGA + TV 5%' AND category = 'TV';
UPDATE public.services SET plan_code = 'giga_tv_10choices' WHERE name ILIKE '%GIGA + TV 10%' AND category = 'TV';
UPDATE public.services SET plan_code = 'giga_tv_15choices' WHERE name ILIKE '%GIGA + TV 15%' AND category = 'TV';
UPDATE public.services SET plan_code = 'giga_tv_25choices' WHERE name ILIKE '%GIGA + TV 25%' AND category = 'TV';

-- Recreate the view to include plan_code
CREATE OR REPLACE VIEW public.services_public AS
SELECT id, name, short_description, description, category, price, billing_type,
       display_order, tags, badges, features_json, is_featured, is_recommended,
       promo_eligible, equipment_rules, activation_fee_rule, installation_fee_rule,
       shipping_fee_rule, visible_website, visible_simulator, visible_checkout,
       visible_portal, status, plan_code
FROM services
WHERE is_active = true;

-- Add index for fast lookup
CREATE INDEX IF NOT EXISTS idx_services_plan_code ON public.services(plan_code) WHERE plan_code IS NOT NULL;

COMMENT ON COLUMN public.services.plan_code IS 'Canonical plan_code matching stripe_plan_mapping. Required for recurring billing subscription creation.';
