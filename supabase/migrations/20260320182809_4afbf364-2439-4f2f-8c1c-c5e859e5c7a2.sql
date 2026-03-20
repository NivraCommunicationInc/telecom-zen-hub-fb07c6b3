-- Add website promos: 50% off first month, 10$/mo x 6mo, free shipping
INSERT INTO field_sales_promotions (name, description, promo_type, discount_monthly, discount_onetime, discount_percentage, duration_months, requires_approval, is_active)
VALUES 
  ('50% de rabais - 1er mois', 'Rabais de bienvenue : 50% de réduction sur le premier mois de services récurrents', 'percentage_off', 0, 0, 50, 1, false, true),
  ('10$/mois x 6 mois', 'Réduction de 10$/mois pendant 6 mois', 'monthly_discount', 10, 0, 0, 6, false, true),
  ('Livraison gratuite', 'Frais de livraison crédités (30$)', 'free_installation', 0, 30, 0, 0, false, true);