ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS taxable_gross NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_taxable_gross NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_deductions NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deduction_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commission_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adjustment_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_email_status
  ON public.payroll_entries(email_status);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_breakdown_gin
  ON public.payroll_entries USING GIN(earnings_breakdown);