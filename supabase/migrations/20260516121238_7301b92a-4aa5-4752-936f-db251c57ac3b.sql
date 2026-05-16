
ALTER TABLE public.agent_discounts
  DROP CONSTRAINT IF EXISTS agent_discounts_applies_to_check;

ALTER TABLE public.agent_discounts
  ADD CONSTRAINT agent_discounts_applies_to_check
  CHECK (applies_to IN (
    'internet','tv','mobile','bundle','all',
    'installation','activation',
    'plans_80_plus','plans_90_plus','plan_only'
  ));

INSERT INTO public.agent_discounts (
  name, type, value, applies_to, duration_months, min_plan_price, is_active, description
)
SELECT 'Activation gratuite', 'remove_fee', 0, 'activation', NULL, NULL, true,
       'Supprime les frais d''activation'
WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_discounts
  WHERE type = 'remove_fee' AND applies_to = 'activation'
);
