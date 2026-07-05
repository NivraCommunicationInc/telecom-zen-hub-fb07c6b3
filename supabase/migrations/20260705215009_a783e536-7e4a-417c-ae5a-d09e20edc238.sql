
UPDATE public.billing_subscriptions s
SET service_address_id = s.address_id
FROM public.billing_customers bc
JOIN public.accounts a ON a.client_id = bc.user_id
WHERE s.customer_id = bc.id
  AND a.account_number = '200756'
  AND s.status = 'active'
  AND s.service_address_id IS NULL
  AND s.address_id IS NOT NULL;

UPDATE public.billing_subscriptions s
SET cycle_end_date = CURRENT_DATE + INTERVAL '1 day'
FROM public.billing_customers bc
JOIN public.accounts a ON a.client_id = bc.user_id
WHERE s.customer_id = bc.id
  AND a.account_number = '200756'
  AND s.status = 'active';
