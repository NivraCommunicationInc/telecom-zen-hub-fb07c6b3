-- BUG N4: add is_permanent column to account_adjustments.
--
-- billing-generate-renewals queries:
--   .or("is_permanent.eq.true,months_remaining.gt.0")
-- and reads adj.is_permanent === true for branch logic.
-- Without this column the PostgREST filter errors → no adjustments ever applied.

ALTER TABLE public.account_adjustments
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT false;

-- Index for the .or() filter used in billing-generate-renewals
CREATE INDEX IF NOT EXISTS idx_account_adjustments_permanent
  ON public.account_adjustments (account_id, status, is_permanent);
