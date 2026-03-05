
-- Fix: The provision_services_for_order function needs to bypass RLS
-- Add SECURITY DEFINER and ensure it can update billing_subscriptions
ALTER FUNCTION public.provision_services_for_order(UUID) SECURITY DEFINER;

-- Also directly fix order 64872's subscription since provisioning already created services
UPDATE billing_subscriptions 
SET status = 'active'::billing_subscription_status, 
    plan_code = 'order-64872',
    updated_at = NOW()
WHERE id = 'a8df05ea-b270-4a2c-936f-a782a0de927f';
