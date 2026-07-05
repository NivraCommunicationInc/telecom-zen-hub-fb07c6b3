
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS autopay_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopay_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopay_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopay_stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_last_error text;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_autopay_next
  ON public.billing_invoices (autopay_next_attempt_at)
  WHERE autopay_stopped = false AND balance_due > 0;
