-- Requeue all 36 DLQ emails so the drain retries them with the new templates
UPDATE public.email_queue
SET status = 'queued',
    attempts = 0,
    last_error = NULL
WHERE status = 'dlq';