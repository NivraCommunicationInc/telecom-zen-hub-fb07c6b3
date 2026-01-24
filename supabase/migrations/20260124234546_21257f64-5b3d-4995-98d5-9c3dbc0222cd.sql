-- SEV0: Email deliverability diagnostics (logging + events)

-- 1) Extend email_queue with requested fields
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS from_email text;

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS subject text;

-- Keep existing provider_response for backwards compatibility; add requested resend_response alias
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS resend_response jsonb;

-- Complaints are part of deliverability signals
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_queue_provider_message_id
  ON public.email_queue (provider_message_id);

-- 2) Create email_events table for webhook events
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_events_message_id_created_at
  ON public.email_events (message_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_message_event_created
  ON public.email_events (message_id, event_type, created_at);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Admins can view email events (read-only in app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_events'
      AND policyname = 'Admins can view email events'
  ) THEN
    CREATE POLICY "Admins can view email events"
    ON public.email_events
    FOR SELECT
    TO authenticated
    USING (public.is_admin_user());
  END IF;
END $$;
