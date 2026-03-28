
-- ═══════════════════════════════════════════
-- HR / PAYROLL / TIME TRACKING SYSTEM
-- ═══════════════════════════════════════════

-- 1. Commission Grid Assignments (link rules to specific employees)
CREATE TABLE public.commission_grid_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rule_id UUID NOT NULL REFERENCES public.field_sales_commission_rules(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_id)
);

ALTER TABLE public.commission_grid_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage grid assignments" ON public.commission_grid_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view own assignments" ON public.commission_grid_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Pay Periods
CREATE TABLE public.pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'closed', 'paid')),
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pay periods" ON public.pay_periods
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view pay periods" ON public.pay_periods
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_active = true AND status = 'active'));

-- 3. Payroll Entries (per employee per period)
CREATE TABLE public.payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID NOT NULL REFERENCES public.pay_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  hours_worked NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  gross_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  deductions_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'void')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pay_period_id, user_id)
);

ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payroll" ON public.payroll_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view own payroll" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Payroll Adjustments (retenues, corrections, bonuses)
CREATE TABLE public.payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('deduction', 'bonus', 'correction', 'clawback', 'tax_withholding', 'other')),
  label TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  applied_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage adjustments" ON public.payroll_adjustments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view own adjustments" ON public.payroll_adjustments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM payroll_entries pe WHERE pe.id = payroll_entry_id AND pe.user_id = auth.uid()));

-- 5. Time Entries (punch in/out)
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  punch_in TIMESTAMPTZ NOT NULL,
  punch_out TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC(6,2),
  entry_type TEXT NOT NULL DEFAULT 'regular' CHECK (entry_type IN ('regular', 'overtime', 'holiday', 'sick', 'vacation')),
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage time entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff manage own time" ON public.time_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Staff Schedules
CREATE TABLE public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schedules" ON public.staff_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view own schedule" ON public.staff_schedules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 7. Commission Disputes (formal)
CREATE TABLE public.commission_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES public.sales_commissions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'accepted', 'rejected', 'closed')),
  admin_response TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage disputes" ON public.commission_disputes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents manage own disputes" ON public.commission_disputes
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 8. Tax Documents tracking
CREATE TABLE public.tax_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('t4', 'rl1', 'releve1', 'summary', 'other')),
  tax_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'acknowledged')),
  generated_by UUID,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  notes TEXT,
  data_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_type, tax_year)
);

ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tax docs" ON public.tax_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view own tax docs" ON public.tax_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_commission_grid_assignments_user ON public.commission_grid_assignments(user_id);
CREATE INDEX idx_payroll_entries_user ON public.payroll_entries(user_id);
CREATE INDEX idx_payroll_entries_period ON public.payroll_entries(pay_period_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_punch ON public.time_entries(punch_in, punch_out);
CREATE INDEX idx_staff_schedules_user ON public.staff_schedules(user_id);
CREATE INDEX idx_commission_disputes_agent ON public.commission_disputes(agent_id);
CREATE INDEX idx_tax_documents_user ON public.tax_documents(user_id, tax_year);
