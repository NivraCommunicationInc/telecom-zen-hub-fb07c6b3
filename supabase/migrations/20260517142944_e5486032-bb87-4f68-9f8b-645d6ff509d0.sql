
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS payment_confirmation_pdf_url text,
  ADD COLUMN IF NOT EXISTS payment_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS payment_marked_by uuid;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_payment_status ON public.payroll_entries(payment_status);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_payment_date ON public.payroll_entries(payment_date);
