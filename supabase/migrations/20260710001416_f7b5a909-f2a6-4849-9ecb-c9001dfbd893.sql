
-- Automation: review request email after activation + install
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS review_email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_discount_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_discount_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_discount_amount_cents integer;

CREATE INDEX IF NOT EXISTS idx_accounts_review_email_pending
  ON public.accounts (status, review_email_sent)
  WHERE review_email_sent = false;
