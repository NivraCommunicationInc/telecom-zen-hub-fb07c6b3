
INSERT INTO public.promotions (
  code, name, description, discount_type, discount_value, 
  applies_to, scope, status, stackable, new_customers_only,
  duration, max_discount_amount
) VALUES (
  'TEST99', 'Test 99% services', 
  'Code audit: 99% de rabais sur forfaits mensuels uniquement',
  'percent', 99,
  '{"services": true, "one_time_fees": false, "equipment": false, "delivery": false, "installation": false}'::jsonb,
  'global', 'active', false, false, 'first_cycle_only', NULL
),
(
  'SAVE50', 'Rabais 50$ services et frais', 
  'Code audit: 50$ de rabais sur forfaits + frais uniques, capé à 50$',
  'fixed_amount', 50,
  '{"services": true, "one_time_fees": true, "equipment": false, "delivery": false, "installation": false}'::jsonb,
  'global', 'active', false, false, 'first_cycle_only', 50
);
