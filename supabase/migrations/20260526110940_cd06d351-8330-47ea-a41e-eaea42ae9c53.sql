-- Cancel duplicate/intermediate status emails still pending in the queue
UPDATE public.email_queue
SET status = 'cancelled',
    last_error = 'Cancelled: duplicate/intermediate order status email superseded by milestone-only policy'
WHERE status IN ('queued','pending','failed')
  AND template_key = 'order_status_update'
  AND created_at > now() - interval '3 days';

-- Cancel pending duplicate contract_sign_request emails (keep only the latest per contract)
WITH ranked AS (
  SELECT id,
         entity_id,
         row_number() OVER (PARTITION BY entity_id ORDER BY created_at DESC) AS rn
  FROM public.email_queue
  WHERE template_key = 'contract_sign_request'
    AND status IN ('queued','pending','failed')
    AND created_at > now() - interval '3 days'
)
UPDATE public.email_queue q
SET status = 'cancelled',
    last_error = 'Cancelled: superseded by latest contract_sign_request'
FROM ranked r
WHERE q.id = r.id AND r.rn > 1;