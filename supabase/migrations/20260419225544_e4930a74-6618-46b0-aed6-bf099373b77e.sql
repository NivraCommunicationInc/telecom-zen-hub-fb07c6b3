-- ─── employee_shifts: date-based shift schedules ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_type text NOT NULL DEFAULT 'regular',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_shifts_type_chk CHECK (shift_type IN ('regular','training','meeting','field','remote'))
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_user_date ON public.employee_shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON public.employee_shifts(shift_date);

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

-- Admin/HR/supervisor can manage all
CREATE POLICY "Staff can view all shifts"
  ON public.employee_shifts FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR auth.uid() = user_id
  );

CREATE POLICY "Admin and supervisor manage shifts"
  ON public.employee_shifts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE TRIGGER trg_employee_shifts_updated_at
  BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── employee_leave_requests: absence/vacation/sick days ──────────────────────
CREATE TABLE IF NOT EXISTS public.employee_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'vacation',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_type_chk CHECK (leave_type IN ('vacation','sick','personal','unpaid','bereavement','parental','other')),
  CONSTRAINT leave_status_chk CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT leave_dates_chk CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.employee_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.employee_leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.employee_leave_requests(status);

ALTER TABLE public.employee_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own leave"
  ON public.employee_leave_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  );

CREATE POLICY "Users create own leave request"
  ON public.employee_leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "Admin and supervisor manage leave"
  ON public.employee_leave_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admin can delete leave requests"
  ON public.employee_leave_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_employee_leave_requests_updated_at
  BEFORE UPDATE ON public.employee_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();