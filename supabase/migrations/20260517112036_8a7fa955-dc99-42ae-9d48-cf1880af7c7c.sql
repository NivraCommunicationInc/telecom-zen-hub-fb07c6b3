-- STEP 1: Extend payroll schema

ALTER TABLE employee_payroll_settings
ADD COLUMN IF NOT EXISTS pay_type TEXT
  DEFAULT 'commission'
  CHECK (pay_type IN ('commission','hourly','hourly_commission'));

ALTER TABLE employee_payroll_settings
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2) DEFAULT 0;

ALTER TABLE employee_payroll_settings
ADD COLUMN IF NOT EXISTS employee_role TEXT;

-- Unique constraint for ON CONFLICT (employee_id) in step 2
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payroll_settings_employee_id_key'
  ) THEN
    BEGIN
      ALTER TABLE employee_payroll_settings
      ADD CONSTRAINT employee_payroll_settings_employee_id_key UNIQUE (employee_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- Timesheet
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  hours_worked NUMERIC(6,2) DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  notes TEXT,
  entered_by UUID REFERENCES profiles(user_id),
  approved_by UUID REFERENCES profiles(user_id),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, pay_period_start)
);

ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin manage timesheets"
  ON timesheet_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee'));

CREATE POLICY "Employees view their own timesheets"
  ON timesheet_entries FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Pay adjustments
CREATE TABLE IF NOT EXISTS pay_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id),
  adjustment_type TEXT NOT NULL
    CHECK (adjustment_type IN ('allocation','bonus','advance','deduction','reimbursement','other')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pay_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin manage adjustments"
  ON pay_adjustments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee'));

CREATE POLICY "Employees view their own adjustments"
  ON pay_adjustments FOR SELECT TO authenticated
  USING (employee_id = auth.uid());