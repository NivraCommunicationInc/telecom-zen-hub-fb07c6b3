-- Sales targets table
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_records(id) ON DELETE CASCADE,
  role text,
  service_type text NOT NULL DEFAULT 'all',
  target_amount numeric,
  target_count integer,
  bonus_amount numeric DEFAULT 0,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_targets_scope_chk CHECK (employee_id IS NOT NULL OR role IS NOT NULL),
  CONSTRAINT sales_targets_value_chk CHECK (target_amount IS NOT NULL OR target_count IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON public.sales_targets(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_employee ON public.sales_targets(employee_id);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage sales_targets"
ON public.sales_targets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Employees can view their own targets
CREATE POLICY "Employees view own sales_targets"
ON public.sales_targets
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employee_records WHERE user_id = auth.uid()
  )
);

-- updated_at trigger
CREATE TRIGGER trg_sales_targets_updated_at
BEFORE UPDATE ON public.sales_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();