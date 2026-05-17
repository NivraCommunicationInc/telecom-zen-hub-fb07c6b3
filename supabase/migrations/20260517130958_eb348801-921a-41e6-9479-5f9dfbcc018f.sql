ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(10,2) DEFAULT 0;

UPDATE public.payroll_entries
SET total_deductions = COALESCE(NULLIF(total_deductions, 0), deductions_total, 0)
WHERE COALESCE(total_deductions, 0) = 0 AND COALESCE(deductions_total, 0) <> 0;