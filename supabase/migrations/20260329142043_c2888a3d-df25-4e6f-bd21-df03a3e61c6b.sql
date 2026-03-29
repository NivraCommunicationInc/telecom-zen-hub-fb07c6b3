
-- Monthly sales objectives for employees
CREATE TABLE IF NOT EXISTS public.employee_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month date NOT NULL,
  target_sales integer NOT NULL DEFAULT 0,
  target_revenue numeric NOT NULL DEFAULT 0,
  current_sales integer NOT NULL DEFAULT 0,
  current_revenue numeric NOT NULL DEFAULT 0,
  estimated_commission numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.employee_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own objectives"
  ON public.employee_objectives FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage objectives"
  ON public.employee_objectives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add link_url to employee_notifications for deep linking
ALTER TABLE public.employee_notifications ADD COLUMN IF NOT EXISTS link_url text DEFAULT NULL;
