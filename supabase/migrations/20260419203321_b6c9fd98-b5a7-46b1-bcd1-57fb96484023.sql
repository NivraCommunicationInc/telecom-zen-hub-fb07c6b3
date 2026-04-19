DROP VIEW IF EXISTS public.unified_commissions;

CREATE VIEW public.unified_commissions
WITH (security_invoker = on) AS
SELECT
  id,
  salesperson_id AS employee_id,
  'sales'::text AS source,
  commission_amount AS amount,
  sale_amount,
  commission_rate,
  status,
  notes,
  created_at,
  updated_at,
  COALESCE(converted_order_id::text, field_order_id::text) AS reference_id,
  validated_at,
  paid_at
FROM public.sales_commissions
UNION ALL
SELECT
  id,
  agent_id AS employee_id,
  'field'::text AS source,
  amount,
  NULL::numeric AS sale_amount,
  NULL::numeric AS commission_rate,
  status,
  notes,
  created_at,
  updated_at,
  COALESCE(order_id::text, lead_id::text) AS reference_id,
  approved_at AS validated_at,
  paid_at
FROM public.field_commissions;

GRANT SELECT ON public.unified_commissions TO authenticated;