-- billing-lifecycle uses both event_key and idempotency_key in email_queue inserts.
-- email_queue only has event_key (UNIQUE). Adding idempotency_key as nullable alias
-- so inserts succeed; event_key remains the authoritative idempotency column.
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS idempotency_key text;
