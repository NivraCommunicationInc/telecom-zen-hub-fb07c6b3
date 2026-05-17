
-- Extend support_tickets with AI-support columns (idempotent)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS ai_response TEXT,
  ADD COLUMN IF NOT EXISTS ai_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Drop existing status CHECK if any, then add an extended one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.support_tickets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.support_tickets DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_chk
  CHECK (status IN (
    'open','pending','in_progress','on_hold',
    'ai_replied','escalated','human_replied',
    'resolved','closed','cancelled'
  ));

-- Source check (idempotent)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.support_tickets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.support_tickets DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_source_chk
  CHECK (source IN ('email','web','phone'));

-- Ticket number auto-fill (TKT-XXXXXXXX) for any insert missing it
CREATE OR REPLACE FUNCTION public.support_tickets_set_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_set_ticket_number ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_set_ticket_number();

-- ticket_replies extensions for email-sourced messages
ALTER TABLE public.ticket_replies
  ADD COLUMN IF NOT EXISTS sender_type TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_email
  ON public.support_tickets (client_email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_scheduled
  ON public.support_tickets (ai_scheduled_at)
  WHERE ai_scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_sender
  ON public.ticket_replies (ticket_id, sender_type);
