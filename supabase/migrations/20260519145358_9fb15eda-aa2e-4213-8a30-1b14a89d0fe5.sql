UPDATE public.email_queue
SET status='queued', attempts=0, last_error=NULL
WHERE event_key LIKE 'interview_done_%' AND status='dlq';