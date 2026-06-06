-- P3: GPS coords on field_quotes, canvas signature column,
--     SMS fallback tracking on email_queue

-- 1. GPS capture at field sale submission time
ALTER TABLE public.field_quotes
  ADD COLUMN IF NOT EXISTS agent_gps_coords JSONB;

COMMENT ON COLUMN public.field_quotes.agent_gps_coords
  IS 'Agent GPS at time of sale: {lat, lng, accuracy_meters}. Captured client-side via Geolocation API.';

-- 2. email_queue: track SMS fallback attempts
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS sms_fallback_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_fallback_at timestamptz;

COMMENT ON COLUMN public.email_queue.sms_fallback_sent
  IS 'True if an SMS fallback was sent after email delivery failed (max_attempts exhausted).';
