
-- Fix subscription plan_price to correct combined monthly (GIGA+TV25=100 + Mobile75=60 = 160)
UPDATE billing_subscriptions 
SET plan_price = 160.00, updated_at = now()
WHERE id = 'd0965936-dbc5-4486-91e6-bd48831af7a2';

-- Fix existing service line - make it the GIGA+TV plan only with correct price
UPDATE billing_subscription_services 
SET service_name = 'GIGA + TV 25 choix',
    service_code = 'giga_tv_25',
    unit_price = 100.00,
    updated_at = now()
WHERE id = '8bd35ca6-6d3a-44b2-a6c4-658a9da0ccaf';

-- Add Mobile 75GB as separate recurring service line
INSERT INTO billing_subscription_services (subscription_id, service_name, service_code, service_type, unit_price, quantity, is_active)
VALUES ('d0965936-dbc5-4486-91e6-bd48831af7a2', 'Mobile 75GB 4G Unlimited Canada', 'mobile_75gb', 'recurring', 60.00, 1, true);

-- Add equipment lines (one_time) matching order equipment_details
INSERT INTO billing_subscription_services (subscription_id, service_name, service_code, service_type, unit_price, quantity, is_active)
VALUES 
  ('d0965936-dbc5-4486-91e6-bd48831af7a2', 'Router Nivra Born Wifi', 'router_wifi', 'one_time', 60.00, 1, true),
  ('d0965936-dbc5-4486-91e6-bd48831af7a2', 'Terminal Nivra 4K Smart', 'terminal_4k', 'one_time', 50.00, 1, true),
  ('d0965936-dbc5-4486-91e6-bd48831af7a2', 'Physical SIM', 'sim_physical', 'one_time', 30.00, 1, true);

-- Delete the failed payment record to avoid confusing duplicate in portal
DELETE FROM billing_payments WHERE id = 'de31467e-276c-48b4-8d6f-9110b7be4e2f' AND status = 'failed';
