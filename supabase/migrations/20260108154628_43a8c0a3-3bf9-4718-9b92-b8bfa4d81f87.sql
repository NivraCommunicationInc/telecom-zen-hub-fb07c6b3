-- ============================================
-- SECURITY FIX: Address all 5 security warnings
-- ============================================

-- 1. Fix RLS "Always True" policies with proper role-based access
-- These tables should only be accessible by service_role or specific authenticated roles

-- ===== admin_audit_log: Only service_role should insert =====
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Service role can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- ===== client_login_pins: Service role only (system managed) =====
DROP POLICY IF EXISTS "Service role manages login pins" ON public.client_login_pins;
CREATE POLICY "Service role manages login pins" 
ON public.client_login_pins 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- ===== email_queue: Service role only (edge functions) =====
DROP POLICY IF EXISTS "System can insert email queue" ON public.email_queue;
DROP POLICY IF EXISTS "System can update email queue" ON public.email_queue;
CREATE POLICY "Service role inserts email queue" 
ON public.email_queue 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role updates email queue" 
ON public.email_queue 
FOR UPDATE 
TO service_role
USING (true);

-- ===== employee_operations_audit: Admin/Employee role based (not always true) =====
DROP POLICY IF EXISTS "Service role full access to employee_operations_audit" ON public.employee_operations_audit;

-- Create helper function if not exists
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'employee')
  )
$$;

-- Staff can read audit logs, service_role can insert
CREATE POLICY "Staff can view operations audit" 
ON public.employee_operations_audit 
FOR SELECT 
TO authenticated
USING (public.is_staff());

CREATE POLICY "Service role inserts operations audit" 
ON public.employee_operations_audit 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- ===== employee_pin_attempts: Staff can insert their own attempts =====
DROP POLICY IF EXISTS "Allow PIN attempt logging" ON public.employee_pin_attempts;
CREATE POLICY "Staff can log PIN attempts" 
ON public.employee_pin_attempts 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_staff());

CREATE POLICY "Staff can view own PIN attempts" 
ON public.employee_pin_attempts 
FOR SELECT 
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE user_id = auth.uid()
));

CREATE POLICY "Service role manages PIN attempts" 
ON public.employee_pin_attempts 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- ===== employee_pin_unlocks: Proper staff-based access =====
DROP POLICY IF EXISTS "Employees can view own unlocks" ON public.employee_pin_unlocks;
DROP POLICY IF EXISTS "Employees can create unlocks" ON public.employee_pin_unlocks;
DROP POLICY IF EXISTS "Employees can update own unlocks" ON public.employee_pin_unlocks;

CREATE POLICY "Staff can view unlocks" 
ON public.employee_pin_unlocks 
FOR SELECT 
TO authenticated
USING (public.is_staff());

CREATE POLICY "Staff can create unlocks" 
ON public.employee_pin_unlocks 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update unlocks" 
ON public.employee_pin_unlocks 
FOR UPDATE 
TO authenticated
USING (public.is_staff());

-- ===== job_applications: Anyone can insert, but with validation =====
-- This is intentionally public for job submissions
DROP POLICY IF EXISTS "Anyone can create job applications" ON public.job_applications;
CREATE POLICY "Anyone can submit job application" 
ON public.job_applications 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  -- Ensure required fields are provided
  full_name IS NOT NULL 
  AND email IS NOT NULL 
  AND phone IS NOT NULL
);

-- ===== notifications: Only service_role inserts =====
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role inserts notifications" 
ON public.notifications 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- ===== rate_limits: Only service_role manages =====
DROP POLICY IF EXISTS "System manages rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits" 
ON public.rate_limits 
FOR ALL 
TO service_role
USING (true);

-- ===== staff_otp_codes: Only service_role inserts =====
DROP POLICY IF EXISTS "Service role can insert OTP" ON public.staff_otp_codes;
CREATE POLICY "Service role inserts OTP" 
ON public.staff_otp_codes 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- 2. Create secure views for public data (site_offers, site_settings)
-- This prevents exposure of internal fields like created_by_id, updated_by_id

-- Secure view for public site offers (no internal metadata)
CREATE OR REPLACE VIEW public.site_offers_public AS
SELECT 
  id,
  offer_type,
  category,
  name_fr,
  name_en,
  description_fr,
  description_en,
  price_monthly,
  price_setup,
  discount_percent,
  discount_amount,
  promo_code,
  valid_from,
  valid_until,
  is_featured,
  features_json,
  sort_order
FROM public.site_offers
WHERE is_active = true
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until >= now());

-- Secure view for public site settings (no internal metadata)
CREATE OR REPLACE VIEW public.site_settings_public AS
SELECT 
  id,
  key,
  value_text,
  value_json,
  description,
  category
FROM public.site_settings
WHERE is_public = true;

-- Grant access to the public views
GRANT SELECT ON public.site_offers_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- 3. Update site_offers RLS to be more restrictive for SELECT
-- Revoke direct public access, use view instead
DROP POLICY IF EXISTS "Public can read active offers" ON public.site_offers;
CREATE POLICY "Authenticated users read active offers" 
ON public.site_offers 
FOR SELECT 
TO authenticated
USING (
  is_active = true 
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until >= now())
);

-- Allow anon to read through the view only (no direct table access)
-- The view will handle the filtering

-- 4. Update site_settings RLS similarly
DROP POLICY IF EXISTS "Public can read public settings" ON public.site_settings;
CREATE POLICY "Authenticated users read public settings" 
ON public.site_settings 
FOR SELECT 
TO authenticated
USING (is_public = true);

-- 5. Add security documentation comment
COMMENT ON TABLE public.site_offers IS 'Product offers - use site_offers_public view for anonymous access';
COMMENT ON TABLE public.site_settings IS 'Site configuration - use site_settings_public view for anonymous access';
COMMENT ON VIEW public.site_offers_public IS 'Secure public view of active offers without internal metadata';
COMMENT ON VIEW public.site_settings_public IS 'Secure public view of public settings without internal metadata';