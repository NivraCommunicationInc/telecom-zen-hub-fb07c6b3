-- ==============================================================================
-- P0 SECURITY FIX PART 2: Hard-block role elevation + Fix RLS policies
-- ==============================================================================

-- STEP 1: DROP broken RLS policies and disable RLS on internal security tables
-- These tables should only be accessible via service_role (edge functions)
-- ==============================================================================

-- Fix admin_access_limits - drop bad policy and use proper service_role access
DROP POLICY IF EXISTS "Service role only" ON public.admin_access_limits;
ALTER TABLE public.admin_access_limits DISABLE ROW LEVEL SECURITY;

-- Fix security_events - drop bad policy and use proper service_role access  
DROP POLICY IF EXISTS "Service role only" ON public.security_events;
ALTER TABLE public.security_events DISABLE ROW LEVEL SECURITY;

-- Fix staff_email_allowlist - drop bad policy and use proper service_role access
DROP POLICY IF EXISTS "Service role only" ON public.staff_email_allowlist;
ALTER TABLE public.staff_email_allowlist DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- STEP 2: HARD-BLOCK role elevation - Replace the validate_role_change function
-- This will RAISE EXCEPTION by default for any staff role INSERT/UPDATE
-- Only service_role context (edge functions called by verified admin) can proceed
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_current_admin_count INTEGER;
  v_current_staff_count INTEGER;
  v_max_admins INTEGER := 5;
  v_max_staff INTEGER := 20;
  v_user_email TEXT;
  v_is_bootstrap_allowlisted BOOLEAN := FALSE;
  v_is_service_role BOOLEAN := FALSE;
BEGIN
  -- Get user email for the target user
  SELECT email INTO v_user_email FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- For client role, always allow (this is the default role on signup)
  IF NEW.role = 'client' THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is being executed by service_role (edge functions)
  -- service_role bypasses RLS and has elevated privileges
  v_is_service_role := (current_setting('role', true) = 'service_role') 
                    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
                    OR (session_user = 'postgres');
  
  -- Get current limits from config table
  SELECT max_admins, max_staff INTO v_max_admins, v_max_staff
  FROM public.admin_access_limits LIMIT 1;
  v_max_admins := COALESCE(v_max_admins, 5);
  v_max_staff := COALESCE(v_max_staff, 20);
  
  -- Count current admins and staff (excluding the current row if UPDATE)
  IF TG_OP = 'UPDATE' THEN
    SELECT COUNT(*) INTO v_current_admin_count
    FROM public.user_roles WHERE role = 'admin' AND id != NEW.id;
    
    SELECT COUNT(*) INTO v_current_staff_count
    FROM public.user_roles WHERE role IN ('admin', 'employee', 'technician') AND id != NEW.id;
  ELSE
    SELECT COUNT(*) INTO v_current_admin_count
    FROM public.user_roles WHERE role = 'admin';
    
    SELECT COUNT(*) INTO v_current_staff_count
    FROM public.user_roles WHERE role IN ('admin', 'employee', 'technician');
  END IF;
  
  -- KILL SWITCH: Hard block if limits exceeded (even for service role)
  IF NEW.role = 'admin' AND v_current_admin_count >= v_max_admins THEN
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'KILL_SWITCH_BLOCKED',
      'critical',
      jsonb_build_object(
        'reason', 'Admin limit exceeded - BLOCKED',
        'attempted_user_id', NEW.user_id,
        'attempted_email', v_user_email,
        'current_count', v_current_admin_count,
        'limit', v_max_admins,
        'blocked_at', now()
      )
    );
    RAISE EXCEPTION 'SECURITY BLOCK: Maximum admin limit (%) reached. Cannot add more admins.', v_max_admins;
  END IF;
  
  IF NEW.role IN ('admin', 'employee', 'technician') AND v_current_staff_count >= v_max_staff THEN
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'KILL_SWITCH_BLOCKED',
      'critical',
      jsonb_build_object(
        'reason', 'Staff limit exceeded - BLOCKED',
        'attempted_user_id', NEW.user_id,
        'attempted_email', v_user_email,
        'current_count', v_current_staff_count,
        'limit', v_max_staff,
        'blocked_at', now()
      )
    );
    RAISE EXCEPTION 'SECURITY BLOCK: Maximum staff limit (%) reached. Cannot add more staff.', v_max_staff;
  END IF;
  
  -- Check bootstrap allowlist (for initial setup only)
  SELECT EXISTS (
    SELECT 1 FROM public.staff_email_allowlist 
    WHERE LOWER(email) = LOWER(v_user_email)
    AND allowed_role = NEW.role
    AND is_bootstrap = true
  ) INTO v_is_bootstrap_allowlisted;
  
  -- HARD BLOCK: Only allow if service_role context OR bootstrap allowlisted
  IF NOT v_is_service_role AND NOT v_is_bootstrap_allowlisted THEN
    -- Log the blocked attempt
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES (
      'ROLE_ELEVATION_BLOCKED',
      'critical',
      jsonb_build_object(
        'reason', 'Unauthorized role elevation attempt - NOT service_role context',
        'user_id', NEW.user_id,
        'email', v_user_email,
        'attempted_role', NEW.role,
        'operation', TG_OP,
        'blocked_at', now()
      )
    );
    RAISE EXCEPTION 'SECURITY BLOCK: Role elevation to % is not permitted outside of authorized admin actions.', NEW.role;
  END IF;
  
  -- Log successful elevation for audit
  INSERT INTO public.security_events (event_type, severity, details)
  VALUES (
    'ROLE_ELEVATION_ALLOWED',
    'info',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'email', v_user_email,
      'new_role', NEW.role,
      'old_role', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END,
      'via_service_role', v_is_service_role,
      'via_allowlist', v_is_bootstrap_allowlisted,
      'operation', TG_OP,
      'allowed_at', now()
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS validate_role_change_trigger ON public.user_roles;
CREATE TRIGGER validate_role_change_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- ==============================================================================
-- STEP 3: Log this security update
-- ==============================================================================

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'SECURITY_FIX_V2_APPLIED',
  'info',
  jsonb_build_object(
    'fix_id', 'P0_2026-01-11_v2',
    'description', 'Hard-block role elevation + fixed RLS policies',
    'changes', ARRAY[
      'Disabled RLS on internal security tables (service_role only access)',
      'Hard-block RAISE EXCEPTION for non-service_role role elevation',
      'Kill-switch now also raises exception',
      'All attempts logged to security_events'
    ]
  )
);