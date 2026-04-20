-- Add attachments column so senders can pass PDFs through the queue
ALTER TABLE public.email_queue 
ADD COLUMN IF NOT EXISTS attachments JSONB;

COMMENT ON COLUMN public.email_queue.attachments IS 
'Optional array of {filename, content (base64), contentType} forwarded to Resend by email-queue-drain.';