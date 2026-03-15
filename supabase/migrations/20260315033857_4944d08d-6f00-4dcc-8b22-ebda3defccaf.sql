
-- Step 2: Drop dependent view and recreate with new columns
DROP VIEW IF EXISTS public.services_public;

CREATE VIEW public.services_public AS
SELECT id, name, short_description, description, category, price, billing_type,
       display_order, tags, badges, features_json, is_featured, is_recommended,
       promo_eligible, equipment_rules, activation_fee_rule, installation_fee_rule,
       shipping_fee_rule, visible_website, visible_simulator, visible_checkout, visible_portal, status
FROM public.services
WHERE is_active = true;

-- Grant access
GRANT SELECT ON public.services_public TO anon, authenticated;
