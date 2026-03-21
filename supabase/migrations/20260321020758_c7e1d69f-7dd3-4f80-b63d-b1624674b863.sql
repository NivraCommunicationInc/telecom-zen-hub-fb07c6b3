-- Fix billing_subscription_services bad service_code for order 78446 subscription
UPDATE public.billing_subscription_services
SET service_code = 'internet_100',
    service_name = 'Internet 100 Mbps',
    service_type = 'internet',
    updated_at = now()
WHERE subscription_id = '5f3e8903-8d80-48e2-9f1f-f2a302a888b0'
  AND service_code = 'Internet 100 Mbps';

-- Also add the streaming_prime service if missing
INSERT INTO public.billing_subscription_services (subscription_id, service_code, service_name, service_type, unit_price, quantity, is_active, added_at)
VALUES ('5f3e8903-8d80-48e2-9f1f-f2a302a888b0', 'streaming_prime', 'Amazon Prime Video', 'streaming', 9.99, 1, true, now())
ON CONFLICT (subscription_id, service_code) DO NOTHING;

-- Reset stripe_setup_status to pending for retry
UPDATE public.billing_subscriptions
SET stripe_setup_status = 'pending',
    updated_at = now()
WHERE id = '5f3e8903-8d80-48e2-9f1f-f2a302a888b0';