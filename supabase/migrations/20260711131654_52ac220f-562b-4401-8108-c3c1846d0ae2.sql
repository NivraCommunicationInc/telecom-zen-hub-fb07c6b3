
-- Module 42 Phase 2: Security Actions hardening
-- 1) Idempotency table for security-account-actions
CREATE TABLE IF NOT EXISTS public.security_action_idempotency (
  idempotency_key uuid PRIMARY KEY,
  action text NOT NULL,
  actor_id uuid,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

GRANT ALL ON public.security_action_idempotency TO service_role;

ALTER TABLE public.security_action_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages security idempotency"
  ON public.security_action_idempotency
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_security_action_idempotency_expires
  ON public.security_action_idempotency (expires_at);

-- 2) Defensive RLS UPDATE policies (Admin/Employee)
-- customer_access_sessions: allow staff to revoke via UPDATE (previously only service_role bypass)
DROP POLICY IF EXISTS "Staff can revoke customer access sessions" ON public.customer_access_sessions;
CREATE POLICY "Staff can revoke customer access sessions"
  ON public.customer_access_sessions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

-- customer_security: allow staff to clear locks via UPDATE
DROP POLICY IF EXISTS "Staff can clear customer security locks" ON public.customer_security;
CREATE POLICY "Staff can clear customer security locks"
  ON public.customer_security
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));
