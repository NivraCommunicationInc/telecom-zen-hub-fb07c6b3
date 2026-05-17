
-- ============================================================
-- TAX BRACKETS (Federal + Quebec)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tax_brackets_federal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL DEFAULT 2026,
  min_income NUMERIC(12,2) NOT NULL,
  max_income NUMERIC(12,2),
  rate NUMERIC(5,4) NOT NULL,
  constant NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_brackets_quebec (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL DEFAULT 2026,
  min_income NUMERIC(12,2) NOT NULL,
  max_income NUMERIC(12,2),
  rate NUMERIC(5,4) NOT NULL,
  constant NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_fed_year_min ON public.tax_brackets_federal(year, min_income);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_qc_year_min ON public.tax_brackets_quebec(year, min_income);

ALTER TABLE public.tax_brackets_federal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_brackets_quebec ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read federal brackets" ON public.tax_brackets_federal;
CREATE POLICY "Staff read federal brackets" ON public.tax_brackets_federal
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );
DROP POLICY IF EXISTS "Admin manage federal brackets" ON public.tax_brackets_federal;
CREATE POLICY "Admin manage federal brackets" ON public.tax_brackets_federal
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff read quebec brackets" ON public.tax_brackets_quebec;
CREATE POLICY "Staff read quebec brackets" ON public.tax_brackets_quebec
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );
DROP POLICY IF EXISTS "Admin manage quebec brackets" ON public.tax_brackets_quebec;
CREATE POLICY "Admin manage quebec brackets" ON public.tax_brackets_quebec
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- EMPLOYEE PAYROLL SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'interac'
    CHECK (payment_method IN ('direct_deposit', 'interac', 'paypal')),
  payment_details JSONB DEFAULT '{}'::jsonb,
  federal_claim_amount NUMERIC(10,2) NOT NULL DEFAULT 15705.00,
  quebec_claim_amount NUMERIC(10,2) NOT NULL DEFAULT 17183.00,
  disability_insurance_rate NUMERIC(5,4) NOT NULL DEFAULT 0.02,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eps_employee ON public.employee_payroll_settings(employee_id);
ALTER TABLE public.employee_payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee read own settings" ON public.employee_payroll_settings;
CREATE POLICY "Employee read own settings" ON public.employee_payroll_settings
  FOR SELECT TO authenticated USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Admin manage payroll settings" ON public.employee_payroll_settings;
CREATE POLICY "Admin manage payroll settings" ON public.employee_payroll_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- PAYROLL RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number TEXT UNIQUE NOT NULL,
  pay_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  cutoff_date TIMESTAMPTZ NOT NULL,
  is_last_friday_of_month BOOLEAN NOT NULL DEFAULT false,
  total_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_date ON public.payroll_runs(pay_date DESC);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read payroll runs" ON public.payroll_runs;
CREATE POLICY "Staff read payroll runs" ON public.payroll_runs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admin manage payroll runs" ON public.payroll_runs;
CREATE POLICY "Admin manage payroll runs" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- EXTEND payroll_entries (additive, non-breaking)
-- ============================================================
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_id UUID,
  ADD COLUMN IF NOT EXISTS agent_number TEXT,
  ADD COLUMN IF NOT EXISTS commission_gross NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gross NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS federal_tax NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quebec_tax NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rrq NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ae NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rqap NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disability_insurance NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','processing','paid','failed','cancelled')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS ytd_gross NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_federal_tax NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_quebec_tax NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_rrq NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_ae NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_rqap NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_disability NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_net NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS paystub_pdf_url TEXT;

-- Allow pay_period_id to be null for new run-based entries
ALTER TABLE public.payroll_entries ALTER COLUMN pay_period_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_run ON public.payroll_entries(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON public.payroll_entries(employee_id);

-- updated_at trigger for employee_payroll_settings
DROP TRIGGER IF EXISTS trg_eps_updated_at ON public.employee_payroll_settings;
CREATE TRIGGER trg_eps_updated_at
  BEFORE UPDATE ON public.employee_payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
