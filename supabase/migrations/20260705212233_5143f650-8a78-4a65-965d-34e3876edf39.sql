INSERT INTO public.subscriptions (
  account_id, order_id, user_id, service_type, plan_name, status,
  amount, monthly_price, billing_cycle, start_date, next_billing_date,
  subscription_number, service_address_id
)
SELECT
  o.account_id, o.id, o.user_id,
  COALESCE(NULLIF(trim(o.service_type),''), 'service'),
  COALESCE(NULLIF(trim(o.service_type),''), 'Service'),
  'active',
  COALESCE(o.total_amount, o.subtotal, 0),
  COALESCE(o.subtotal, o.total_amount, 0),
  'monthly',
  COALESCE(o.service_activated_at::date, o.payment_confirmed_at::date, o.created_at::date, CURRENT_DATE),
  COALESCE(o.service_activated_at::date, o.payment_confirmed_at::date, o.created_at::date, CURRENT_DATE) + INTERVAL '30 days',
  'SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0'),
  COALESCE(
    (SELECT sa.id FROM public.service_addresses sa WHERE sa.id = o.service_address_id),
    (SELECT sa.id FROM public.service_addresses sa
     WHERE sa.account_id = o.account_id AND sa.is_default = true
       AND sa.is_active = true AND sa.deleted_at IS NULL LIMIT 1))
FROM public.orders o
WHERE o.status IN ('activated','confirmed','provisioning','shipped','installed')
  AND o.account_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.order_id = o.id);

UPDATE public.subscriptions s
SET service_address_id = sa.id, updated_at = now()
FROM public.service_addresses sa
WHERE s.account_id = sa.account_id
  AND s.service_address_id IS NULL
  AND sa.is_default = true AND sa.is_active = true AND sa.deleted_at IS NULL;

UPDATE public.equipment_inventory ei
SET service_address_id = sa.id,
    address_id = COALESCE(ei.address_id, sa.id),
    updated_at = now()
FROM public.service_addresses sa
WHERE ei.account_id = sa.account_id
  AND ei.service_address_id IS NULL
  AND sa.is_default = true AND sa.is_active = true AND sa.deleted_at IS NULL;