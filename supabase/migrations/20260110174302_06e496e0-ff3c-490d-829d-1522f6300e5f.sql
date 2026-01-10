-- Backfill service_instances for completed orders that don't have one yet
INSERT INTO public.service_instances (
  user_id,
  account_id,
  order_id,
  service_type,
  plan_name,
  status,
  monthly_price,
  start_date,
  equipment_details,
  created_at
)
SELECT 
  o.user_id,
  o.account_id,
  o.id as order_id,
  COALESCE(o.service_type, o.category, 'service') as service_type,
  o.service_type as plan_name,
  'active' as status,
  COALESCE(o.subtotal, o.total_amount) as monthly_price,
  COALESCE(DATE(o.updated_at), CURRENT_DATE) as start_date,
  COALESCE(o.equipment_details, '{}'::jsonb) as equipment_details,
  NOW() as created_at
FROM public.orders o
WHERE o.status IN ('installation_completed', 'completed', 'delivered', 'activated')
AND NOT EXISTS (
  SELECT 1 FROM public.service_instances si WHERE si.order_id = o.id
);