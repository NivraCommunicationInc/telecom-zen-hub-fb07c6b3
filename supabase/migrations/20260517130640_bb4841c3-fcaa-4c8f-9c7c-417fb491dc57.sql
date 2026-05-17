ALTER TABLE public.pay_adjustments
  DROP CONSTRAINT IF EXISTS pay_adjustments_adjustment_type_check;

ALTER TABLE public.pay_adjustments
  ADD CONSTRAINT pay_adjustments_adjustment_type_check
  CHECK (adjustment_type IN ('allocation','bonus','supplement','advance','deduction','reimbursement','other'));