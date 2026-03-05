
-- ============================================================================
-- 1. CREATE admin_audit_sessions TABLE
-- Tracks magic link audit sessions with TTL 10 minutes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  admin_email text,
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  reason text NOT NULL,
  redirect_to text,
  ip_address text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  revoked_at timestamptz,
  magic_link_hash text,
  session_token text
);

CREATE INDEX idx_audit_sessions_active_target 
ON admin_audit_sessions (target_user_id) 
WHERE consumed_at IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX idx_audit_sessions_admin 
ON admin_audit_sessions (admin_user_id, issued_at DESC);

ALTER TABLE admin_audit_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_audit_sessions" ON admin_audit_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 2. SECURITY DEFINER: is_audit_session_active(user_id)
-- Returns TRUE if user has an active consumed audit session (not expired/revoked)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_audit_session_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_audit_sessions
    WHERE target_user_id = _user_id
      AND consumed_at IS NOT NULL
      AND revoked_at IS NULL
      AND expires_at > now()
  )
$$;

-- ============================================================================
-- 3. READ-ONLY AUDIT MODE: Restrictive policies blocking writes during audit
-- ============================================================================

CREATE POLICY "audit_readonly_billing_subscriptions" ON billing_subscriptions
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_billing_invoices" ON billing_invoices
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_billing_payments" ON billing_payments
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_accounts" ON accounts
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_profiles" ON profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_orders" ON orders
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_service_addresses" ON service_addresses
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_billing_customers" ON billing_customers
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_authorized_users" ON authorized_users
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_channel_selections" ON channel_selections
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_account_deletion_requests" ON account_deletion_requests
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_support_tickets" ON support_tickets
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));

CREATE POLICY "audit_readonly_billing" ON billing
  AS RESTRICTIVE FOR ALL TO authenticated
  WITH CHECK (NOT is_audit_session_active(auth.uid()));
