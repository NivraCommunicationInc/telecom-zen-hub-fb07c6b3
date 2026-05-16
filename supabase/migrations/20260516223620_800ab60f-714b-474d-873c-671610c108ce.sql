ALTER TABLE public.email_queue
ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_email_queue_status_priority_retry
ON public.email_queue (status, priority DESC, next_retry_at, created_at);

NOTIFY pgrst, 'reload schema';