
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource text,
  ip text,
  success boolean DEFAULT true,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read security audit log"
ON public.security_audit_log FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Index for fast lookups by action and user
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON public.security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON public.security_audit_log(created_at DESC);
