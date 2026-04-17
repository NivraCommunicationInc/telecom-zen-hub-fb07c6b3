-- Allow 'dlq' (dead letter queue) status on email_queue so the drain
-- processor can mark unrecoverable emails for admin review.
ALTER TABLE public.email_queue
  DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_status_check
  CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'dlq'::text]));

-- Index to speed up the drain processor's "queued or failed" scan.
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created
  ON public.email_queue (status, created_at)
  WHERE status IN ('queued', 'failed');