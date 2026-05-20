UPDATE email_queue
SET status = 'queued', last_error = NULL, attempts = 0
WHERE id = '06041a6b-ca95-41a1-a303-80afbdf092bb';