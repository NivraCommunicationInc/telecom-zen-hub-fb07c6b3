ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS prospect_name text,
  ADD COLUMN IF NOT EXISTS prospect_email text,
  ADD COLUMN IF NOT EXISTS prospect_phone text,
  ADD COLUMN IF NOT EXISTS is_prospect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;