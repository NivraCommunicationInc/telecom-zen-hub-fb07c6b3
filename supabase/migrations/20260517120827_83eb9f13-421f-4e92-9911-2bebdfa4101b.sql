
ALTER TABLE public.field_commissions
  ADD COLUMN IF NOT EXISTS paid_in_run_id uuid,
  ADD COLUMN IF NOT EXISTS paid_in_entry_id uuid;

CREATE INDEX IF NOT EXISTS idx_field_commissions_paid_in_run
  ON public.field_commissions(paid_in_run_id) WHERE paid_in_run_id IS NOT NULL;
