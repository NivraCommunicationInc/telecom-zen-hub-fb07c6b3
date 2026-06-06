-- Backfill cycle_start_date / cycle_end_date on active billing_subscriptions
-- where they are NULL (created before automated date logic was in place).
-- Uses order.created_at as cycle start anchor when available.

UPDATE public.billing_subscriptions bs
SET
  cycle_start_date = COALESCE(
    bs.cycle_start_date,
    o.created_at::date,
    bs.created_at::date,
    CURRENT_DATE
  ),
  cycle_end_date = COALESCE(
    bs.cycle_end_date,
    (COALESCE(o.created_at::date, bs.created_at::date, CURRENT_DATE) + interval '30 days')::date
  ),
  updated_at = now()
FROM public.orders o
WHERE bs.order_id = o.id
  AND bs.status = 'active'
  AND bs.cycle_end_date IS NULL;

-- Fallback for active subs with no linked order
UPDATE public.billing_subscriptions bs
SET
  cycle_start_date = COALESCE(bs.cycle_start_date, bs.created_at::date, CURRENT_DATE),
  cycle_end_date   = COALESCE(
    bs.cycle_end_date,
    (COALESCE(bs.cycle_start_date, bs.created_at::date, CURRENT_DATE) + interval '30 days')::date
  ),
  updated_at = now()
WHERE bs.status = 'active'
  AND bs.cycle_end_date IS NULL;
