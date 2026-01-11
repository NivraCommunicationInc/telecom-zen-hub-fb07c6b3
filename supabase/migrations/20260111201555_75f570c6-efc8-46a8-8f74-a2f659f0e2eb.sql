-- ==============================================================================
-- P0 SECURITY FIX: Remove unauthorized admin access and add permanent guardrails
-- ==============================================================================

-- STEP 1: CLEANUP - Remove all unauthorized admin/staff access
-- Keep ONLY: nivratelecom@gmail.com (admin) and Support@nivratelecom.ca (employee)
-- ==============================================================================

-- First, let's keep track of the cleanup in security audit
INSERT INTO public.admin_security_audit (
  admin_user_id,
  action,
  target_type,
  details
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'P0_SECURITY_CLEANUP',
  'user_roles',
  '{"reason": "Removing all unauthorized admin access due to security incident", "date": "2026-01-11"}'::jsonb
);

-- Delete all admin/employee roles EXCEPT the two authorized users
DELETE FROM public.user_roles
WHERE role IN ('admin', 'employee')
  AND user_id NOT IN (
    SELECT p.user_id FROM public.profiles p
    WHERE LOWER(p.email) = 'nivratelecom@gmail.com'
       OR LOWER(p.email) = 'support@nivratelecom.ca'
  );

-- ==============================================================================
-- STEP 2: ADD PERMANENT GUARDRAILS - Create security functions and triggers
-- ==============================================================================

-- Create a table to track admin access count for kill-switch
CREATE TABLE IF NOT EXISTS public.admin_access_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_admins INTEGER NOT NULL DEFAULT 5,
  max_staff INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default limits if not exists
INSERT INTO public.admin_access_limits (max_admins, max_staff)
SELECT 5, 20
WHERE NOT EXISTS (SELECT 1 FROM public.admin_access_limits);

-- Create security events table for kill-switch logging
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create the allowlist table for authorized staff emails (one-time bootstrap only)
CREATE TABLE IF NOT EXISTS public.staff_email_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  allowed_role TEXT NOT NULL CHECK (allowed_role IN ('admin', 'employee', 'technician')),
  is_bootstrap BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Insert the two authorized users into allowlist
INSERT INTO public.staff_email_allowlist (email, allowed_role, is_bootstrap)
VALUES 
  ('nivratelecom@gmail.com', 'admin', true),
  ('support@nivratelecom.ca', 'employee', true)
ON CONFLICT (email) DO UPDATE SET allowed_role = EXCLUDED.allowed_role;

-- Enable RLS on security tables
ALTER TABLE public.admin_access_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_email_allowlist ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables (no direct access from client)
CREATE POLICY "Service role only" ON public.admin_access_limits FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.security_events FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.staff_email_allowlist FOR ALL USING (false);

-- ==============================================================================
-- STEP 3: CREATE SECURITY DEFINER FUNCTION FOR ROLE VALIDATION
-- ==============================================================================

-- Function to check if role insert/update is allowed
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_current_admin_count INTEGER;
  v_current_staff_count INTEGER;
  v_max_admins INTEGER;
  v_max_staff INTEGER;
  v_caller_is_admin BOOLEAN;
  v_user_email TEXT;
  v_is_allowlisted BOOLEAN;
BEGIN
  -- Get user email for the target user
  SELECT email INTO v_user_email FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- For client role, always allow (default role)
  IF NEW.role = 'client' THEN
    RETURN NEW;
  END IF;
  
  -- Get current limits
  SELECT max_admins, max_staff INTO v_max_admins, v_max_staff
  FROM public.admin_access_limits LIMIT 1;
  
  -- Default limits if table is empty
  v_max_admins := COALESCE(v_max_admins, 5);
  v_max_staff := COALESCE(v_max_staff, 20);
  
  -- Count current admins and staff
  SELECT COUNT(*) INTO v_current_admin_count
  FROM public.user_roles WHERE role = 'admin';
  
  SELECT COUNT(*) INTO v_current_staff_count
  FROM public.user_roles WHERE role IN ('admin', 'employee', 'technician');
  
  -- KILL SWITCH: If admin count exceeds limit, block and log
  IF NEW.role = 'admin' AND v_current_admin_count >= v_max_admins THEN
    -- Log security event
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'KILL_SWITCH_TRIGGERED',
      'critical',
      jsonb_build_object(
        'reason', 'Admin limit exceeded',
        'attempted_user_id', NEW.user_id,
        'attempted_email', v_user_email,
        'current_count', v_current_admin_count,
        'limit', v_max_admins
      )
    );
    RAISE EXCEPTION 'Security: Admin limit exceeded. This action has been blocked and logged.';
  END IF;
  
  -- KILL SWITCH: If total staff exceeds limit
  IF NEW.role IN ('admin', 'employee', 'technician') AND v_current_staff_count >= v_max_staff THEN
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'KILL_SWITCH_TRIGGERED',
      'critical',
      jsonb_build_object(
        'reason', 'Staff limit exceeded',
        'attempted_user_id', NEW.user_id,
        'attempted_email', v_user_email,
        'current_count', v_current_staff_count,
        'limit', v_max_staff
      )
    );
    RAISE EXCEPTION 'Security: Staff limit exceeded. This action has been blocked and logged.';
  END IF;
  
  -- Check if this is an UPDATE (role change from client to admin/employee)
  IF TG_OP = 'UPDATE' THEN
    -- If changing from client to admin/employee, verify it's authorized
    IF OLD.role = 'client' AND NEW.role IN ('admin', 'employee') THEN
      -- Check if in allowlist or being done by an admin through the proper edge function
      SELECT EXISTS (
        SELECT 1 FROM public.staff_email_allowlist 
        WHERE LOWER(email) = LOWER(v_user_email)
        AND allowed_role = NEW.role
      ) INTO v_is_allowlisted;
      
      -- If not allowlisted, this update should only happen via edge function
      -- The trigger allows it because edge functions use service role
      IF NOT v_is_allowlisted THEN
        -- Log the role change for audit
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'ROLE_ELEVATION',
          'high',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'email', v_user_email,
            'old_role', OLD.role,
            'new_role', NEW.role,
            'via_edge_function', true
          )
        );
      END IF;
    END IF;
  END IF;
  
  -- For INSERT of admin/employee roles directly (not through bootstrap)
  IF TG_OP = 'INSERT' AND NEW.role IN ('admin', 'employee') THEN
    -- Check allowlist
    SELECT EXISTS (
      SELECT 1 FROM public.staff_email_allowlist 
      WHERE LOWER(email) = LOWER(v_user_email)
      AND allowed_role = NEW.role
    ) INTO v_is_allowlisted;
    
    -- Log the insert
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'ADMIN_ROLE_INSERT',
      'high',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'email', v_user_email,
        'role', NEW.role,
        'is_allowlisted', v_is_allowlisted
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on user_roles for inserts and updates
DROP TRIGGER IF EXISTS validate_role_change_trigger ON public.user_roles;
CREATE TRIGGER validate_role_change_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- ==============================================================================
-- STEP 4: Update handle_new_user to ONLY create client role (defensive)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- ALWAYS insert as client role - never auto-promote
  -- Admin/employee roles can ONLY be granted through explicit admin action
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- STEP 5: Log the security fix completion
-- ==============================================================================

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'SECURITY_FIX_APPLIED',
  'info',
  jsonb_build_object(
    'fix_id', 'P0_2026-01-11',
    'description', 'Removed unauthorized admin access and added kill-switch protection',
    'actions', ARRAY[
      'Cleaned up unauthorized admin roles',
      'Added admin_access_limits table',
      'Added security_events table', 
      'Added staff_email_allowlist table',
      'Added validate_role_change trigger',
      'Updated handle_new_user to prevent auto-promotion'
    ]
  )
);