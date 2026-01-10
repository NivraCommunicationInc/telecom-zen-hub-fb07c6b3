
-- =========================================================
-- Fix "RLS Policy Always True" warnings
-- Replace USING(true) / WITH CHECK(true) with explicit conditions
-- Functionality remains identical (service_role bypass)
-- =========================================================

-- 1. admin_audit_log: Service role can insert audit logs
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Service role can insert audit logs"
ON public.admin_audit_log
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 2. admin_security_audit: System can insert security audit  
-- Note: This is TO public but should be TO service_role
DROP POLICY IF EXISTS "System can insert security audit" ON public.admin_security_audit;
CREATE POLICY "System can insert security audit"
ON public.admin_security_audit
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 3. admin_users: Service role can manage admin_users
DROP POLICY IF EXISTS "Service role can manage admin_users" ON public.admin_users;
CREATE POLICY "Service role can manage admin_users"
ON public.admin_users
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. client_login_pins: Service role manages login pins
DROP POLICY IF EXISTS "Service role manages login pins" ON public.client_login_pins;
CREATE POLICY "Service role manages login pins"
ON public.client_login_pins
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. email_queue: Service role inserts email queue
DROP POLICY IF EXISTS "Service role inserts email queue" ON public.email_queue;
CREATE POLICY "Service role inserts email queue"
ON public.email_queue
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 6. email_queue: Service role updates email queue
DROP POLICY IF EXISTS "Service role updates email queue" ON public.email_queue;
CREATE POLICY "Service role updates email queue"
ON public.email_queue
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role');

-- 7. employee_operations_audit: Service role inserts operations audit
DROP POLICY IF EXISTS "Service role inserts operations audit" ON public.employee_operations_audit;
CREATE POLICY "Service role inserts operations audit"
ON public.employee_operations_audit
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 8. employee_pin_attempts: Service role manages PIN attempts
DROP POLICY IF EXISTS "Service role manages PIN attempts" ON public.employee_pin_attempts;
CREATE POLICY "Service role manages PIN attempts"
ON public.employee_pin_attempts
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 9. notifications: Service role inserts notifications
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.notifications;
CREATE POLICY "Service role inserts notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 10. rate_limit_attempts: Service role manages rate limit attempts
DROP POLICY IF EXISTS "Service role manages rate limit attempts" ON public.rate_limit_attempts;
CREATE POLICY "Service role manages rate limit attempts"
ON public.rate_limit_attempts
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 11. rate_limit_lockouts: Service role manages rate limit lockouts
DROP POLICY IF EXISTS "Service role manages rate limit lockouts" ON public.rate_limit_lockouts;
CREATE POLICY "Service role manages rate limit lockouts"
ON public.rate_limit_lockouts
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 12. rate_limits: Service role manages rate limits
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 13. security_incidents: Service role inserts security incidents
DROP POLICY IF EXISTS "Service role inserts security incidents" ON public.security_incidents;
CREATE POLICY "Service role inserts security incidents"
ON public.security_incidents
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- 14. staff_otp_codes: Service role inserts OTP
DROP POLICY IF EXISTS "Service role inserts OTP" ON public.staff_otp_codes;
CREATE POLICY "Service role inserts OTP"
ON public.staff_otp_codes
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');
