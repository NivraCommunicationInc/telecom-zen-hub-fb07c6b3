ALTER TABLE public.service_cancellation_requests
ADD COLUMN IF NOT EXISTS subscription_id uuid;

CREATE INDEX IF NOT EXISTS idx_service_cancellation_requests_subscription_id
ON public.service_cancellation_requests(subscription_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_cancellation_requests_subscription_id_fkey'
      AND conrelid = 'public.service_cancellation_requests'::regclass
  ) THEN
    ALTER TABLE public.service_cancellation_requests
    ADD CONSTRAINT service_cancellation_requests_subscription_id_fkey
    FOREIGN KEY (subscription_id)
    REFERENCES public.billing_subscriptions(id)
    ON DELETE SET NULL;
  END IF;
END $$;