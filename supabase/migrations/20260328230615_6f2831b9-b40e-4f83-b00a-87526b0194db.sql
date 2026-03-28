
-- Employment letters table
CREATE TABLE IF NOT EXISTS public.employment_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  letter_type text NOT NULL DEFAULT 'confirmation',
  letter_number text,
  job_title text,
  employment_type text DEFAULT 'commission',
  start_date date,
  salary_info text,
  employee_address text,
  custom_content text,
  pdf_url text,
  status text NOT NULL DEFAULT 'draft',
  generated_at timestamptz,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employment_letters ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_all_employment_letters" ON public.employment_letters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Employees can read their own letters
CREATE POLICY "employees_read_own_letters" ON public.employment_letters
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Add pdf_url to tax_documents if not exists
ALTER TABLE public.tax_documents ADD COLUMN IF NOT EXISTS pdf_url text;

-- Add job_title to profiles if not exists  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric;
