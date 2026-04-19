ALTER TABLE public.employee_records
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS sin_encrypted text,
  ADD COLUMN IF NOT EXISTS last_salary_review_date date,
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS compensation_notes text;

CREATE TABLE IF NOT EXISTS public.employee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_records(id) ON DELETE CASCADE,
  note text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('performance','disciplinary','hr','general')),
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_notes_employee ON public.employee_notes(employee_id, created_at DESC);

ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view employee notes" ON public.employee_notes;
CREATE POLICY "Admins can view employee notes"
  ON public.employee_notes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can insert employee notes" ON public.employee_notes;
CREATE POLICY "Admins can insert employee notes"
  ON public.employee_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  );
