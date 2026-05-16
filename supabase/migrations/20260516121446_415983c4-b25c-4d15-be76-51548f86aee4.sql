
ALTER TABLE public.account_adjustments
  ADD COLUMN IF NOT EXISTS applies_to TEXT,
  ADD COLUMN IF NOT EXISTS conditions TEXT,
  ADD COLUMN IF NOT EXISTS source_discount_id UUID
    REFERENCES public.agent_discounts(id) ON DELETE SET NULL;

ALTER TABLE public.account_adjustments
  DROP CONSTRAINT IF EXISTS account_adjustments_type_check;

ALTER TABLE public.account_adjustments
  ADD CONSTRAINT account_adjustments_type_check
  CHECK (type IN ('credit','fee','remove_fee','first_month_free','one_time'));
