-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  pin_hash TEXT NOT NULL,
  permissions_json JSONB NOT NULL DEFAULT '{
    "can_view_orders": true,
    "can_edit_orders_status": false,
    "can_view_appointments": true,
    "can_manage_appointments": false,
    "can_view_tickets": true,
    "can_manage_tickets": true,
    "can_view_clients": true,
    "can_edit_clients": false,
    "can_generate_invoices": false,
    "can_edit_invoices": false,
    "can_confirm_payments": false,
    "can_ship_orders": false
  }'::jsonb,
  failed_login_attempts INTEGER DEFAULT 0,
  lockout_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_admin_id UUID
);

-- Create employee_audit_logs table
CREATE TABLE public.employee_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  target_employee_email TEXT,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_employees_email ON public.employees(email);
CREATE INDEX idx_employees_is_active ON public.employees(is_active);
CREATE INDEX idx_employee_audit_logs_target ON public.employee_audit_logs(target_employee_id);
CREATE INDEX idx_employee_audit_logs_created ON public.employee_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees table
CREATE POLICY "Admins can manage all employees"
ON public.employees
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own record"
ON public.employees
FOR SELECT
USING (email = (SELECT email FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for employee_audit_logs
CREATE POLICY "Admins can manage employee audit logs"
ON public.employee_audit_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view audit logs about themselves"
ON public.employee_audit_logs
FOR SELECT
USING (target_employee_id IN (
  SELECT id FROM employees WHERE email = (SELECT email FROM profiles WHERE user_id = auth.uid())
));

-- Trigger to update updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();