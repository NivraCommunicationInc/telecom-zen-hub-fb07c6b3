ALTER TABLE public.service_change_requests
ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ;

UPDATE public.service_change_requests scr
SET effective_date = bs.next_renewal_at
FROM public.billing_subscriptions bs
WHERE bs.id = scr.subscription_id
  AND scr.effective_date IS NULL
  AND scr.status = 'pending';