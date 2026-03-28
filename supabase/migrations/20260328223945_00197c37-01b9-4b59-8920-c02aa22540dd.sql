
-- 1. Add user_id to staff_notifications for targeted notifications
ALTER TABLE public.staff_notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create hr_audit_log for complete audit trail
CREATE TABLE IF NOT EXISTS public.hr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  field_changed text,
  old_value text,
  new_value text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
CREATE POLICY "admins_read_hr_audit" ON public.hr_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert audit logs
CREATE POLICY "admins_insert_hr_audit" ON public.hr_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Employees can see their own audit entries
CREATE POLICY "employees_read_own_hr_audit" ON public.hr_audit_log
  FOR SELECT TO authenticated
  USING (entity_id = auth.uid()::text OR actor_user_id = auth.uid());
