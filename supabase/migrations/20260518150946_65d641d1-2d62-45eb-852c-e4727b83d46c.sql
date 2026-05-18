-- 1) Re-queue DLQ email_queue entries for the 3 now-supported templates
UPDATE public.email_queue
SET status = 'queued',
    last_error = NULL,
    attempts = 0
WHERE status = 'dlq'
  AND template_key IN ('employee_badge_ready','ticket_reply','all_documents_sent','technician_assigned');

-- 2) Reset retry_count on stuck KYC_APPROVED notifications so worker retries
UPDATE public.notification_outbox
SET retry_count = 0,
    error_message = NULL
WHERE status = 'queued'
  AND event_type = 'KYC_APPROVED';

-- 3) Drop unused Stripe columns from billing_subscriptions (Stripe fully decommissioned)
ALTER TABLE public.billing_subscriptions
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS stripe_product_id,
  DROP COLUMN IF EXISTS stripe_status,
  DROP COLUMN IF EXISTS stripe_current_period_start,
  DROP COLUMN IF EXISTS stripe_current_period_end,
  DROP COLUMN IF EXISTS stripe_cancel_at,
  DROP COLUMN IF EXISTS stripe_canceled_at,
  DROP COLUMN IF EXISTS stripe_default_payment_method,
  DROP COLUMN IF EXISTS stripe_setup_status;