
-- Ensure helper function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- employee_records — Canonical HR dossier
CREATE TABLE public.employee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_number TEXT UNIQUE NOT NULL DEFAULT '',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  personal_email TEXT,
  work_email TEXT,
  phone TEXT,
  department TEXT,
  job_title TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  hire_date DATE,
  probation_end_date DATE,
  termination_date DATE,
  salary_type TEXT NOT NULL DEFAULT 'hourly',
  hourly_rate NUMERIC(10,2),
  base_salary NUMERIC(10,2),
  commission_enabled BOOLEAN NOT NULL DEFAULT false,
  commission_grid_id UUID,
  payment_method TEXT NOT NULL DEFAULT 'direct_deposit',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  status TEXT NOT NULL DEFAULT 'pending_invitation',
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_checklist JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  notes TEXT
);

CREATE INDEX idx_employee_records_user_id ON public.employee_records(user_id);
CREATE INDEX idx_employee_records_status ON public.employee_records(status);
CREATE INDEX idx_employee_records_department ON public.employee_records(department);

-- Auto-generate employee_number: NIV-EMP-XXXX
CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(employee_number, '[^0-9]', '', 'g'), '') AS INT)), 0) + 1
  INTO next_num FROM public.employee_records;
  IF NEW.employee_number IS NULL OR NEW.employee_number = '' THEN
    NEW.employee_number := 'NIV-EMP-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_generate_employee_number
  BEFORE INSERT ON public.employee_records FOR EACH ROW
  EXECUTE FUNCTION public.generate_employee_number();

CREATE TRIGGER set_employee_records_updated_at
  BEFORE UPDATE ON public.employee_records FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employee records"
  ON public.employee_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can read own record"
  ON public.employee_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Supervisors can read all employee records"
  ON public.employee_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
