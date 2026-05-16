ALTER TABLE public.account_adjustments
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_account_adjustments_permanent_active
  ON public.account_adjustments (account_id, status)
  WHERE is_permanent = true;