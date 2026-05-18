DROP VIEW IF EXISTS public.services_public;
CREATE VIEW public.services_public
WITH (security_invoker = on) AS
SELECT id, name, name_en, short_description, short_description_en, description, description_en,
  category, price, billing_type, display_order, tags, badges,
  features_json, features_json_en,
  is_featured, is_recommended, promo_eligible, equipment_rules,
  activation_fee_rule, installation_fee_rule, shipping_fee_rule,
  visible_website, visible_simulator, visible_checkout, visible_portal,
  status, plan_code
FROM public.services
WHERE is_active = true;
GRANT SELECT ON public.services_public TO anon, authenticated;