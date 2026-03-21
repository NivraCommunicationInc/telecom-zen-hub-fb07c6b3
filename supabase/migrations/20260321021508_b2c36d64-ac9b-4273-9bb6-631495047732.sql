-- Reset stripe_setup_status to pending for retry after factory fix
UPDATE public.billing_subscriptions
SET stripe_setup_status = 'pending',
    updated_at = now()
WHERE id = '5f3e8903-8d80-48e2-9f1f-f2a302a888b0'
  AND stripe_subscription_id IS NULL;