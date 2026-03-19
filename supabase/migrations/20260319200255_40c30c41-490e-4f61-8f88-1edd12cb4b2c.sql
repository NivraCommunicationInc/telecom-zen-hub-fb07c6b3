
-- ============================================
-- Extended Internal Audit Trail
-- ============================================
CREATE TABLE IF NOT EXISTS public.internal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  user_role text,
  action text NOT NULL,
  category text NOT NULL,
  portal text,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and supervisors can read the full audit log
CREATE POLICY "Admin/supervisor can read internal_audit_log"
  ON public.internal_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
  );

-- Staff can insert their own audit records
CREATE POLICY "Staff can insert own internal_audit_log"
  ON public.internal_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for fast querying
CREATE INDEX IF NOT EXISTS idx_internal_audit_log_user_id ON public.internal_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_audit_log_category ON public.internal_audit_log(category);
CREATE INDEX IF NOT EXISTS idx_internal_audit_log_action ON public.internal_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_internal_audit_log_created_at ON public.internal_audit_log(created_at DESC);

-- ============================================
-- Step-up auth sessions table
-- Tracks recent re-authentication for sensitive actions
-- ============================================
CREATE TABLE IF NOT EXISTS public.step_up_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'password',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  revoked_at timestamptz
);

ALTER TABLE public.step_up_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own step_up_sessions"
  ON public.step_up_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_step_up_sessions_user ON public.step_up_sessions(user_id, expires_at DESC);

-- ============================================
-- Track MFA enrollment requirement
-- ============================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

-- All internal staff require MFA
UPDATE public.user_roles
SET mfa_required = true
WHERE role IN ('admin', 'employee', 'technician', 'supervisor', 'sales', 'kyc_agent', 'billing_admin', 'techops', 'support', 'field_sales');
