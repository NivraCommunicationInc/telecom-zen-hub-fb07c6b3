-- Phase 3: Add message_type, entity_type, entity_id columns to email_queue for better ops filtering
ALTER TABLE public.email_queue 
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS preview_text text;

-- Index for ops dashboard filtering
CREATE INDEX IF NOT EXISTS idx_email_queue_message_type ON public.email_queue(message_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_entity ON public.email_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created ON public.email_queue(status, created_at DESC);

-- Add composite index for retry processing
CREATE INDEX IF NOT EXISTS idx_email_queue_retry ON public.email_queue(status, next_retry_at) 
  WHERE status IN ('queued', 'pending');