-- P0 FINAL SECURITY PATCH

-- 1) Replace validate_role_change() with safe logging that cannot break the hard-block
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role_value text;
  v_current_user text;
BEGIN
  -- Get the role being set
  v_role_value := NEW.role::text;
  v_current_user := current_user;
  
  -- Check if this is a staff role
  IF v_role_value IN ('admin', 'employee', 'technician') THEN
    -- ONLY service_role can set staff roles - this is the ONLY allowed path
    IF v_current_user = 'service_role' THEN
      -- Safe logging attempt - wrapped in exception handler so it cannot break the allow
      BEGIN
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'role_change_allowed',
          'info',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'role', v_role_value,
            'executor', v_current_user,
            'operation', TG_OP
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Logging failure must not block the operation
        NULL;
      END;
      
      RETURN NEW;
    ELSE
      -- HARD BLOCK - non-service_role attempting staff role
      -- Try to log, but wrapped so it cannot prevent the exception
      BEGIN
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'role_elevation_blocked',
          'critical',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'attempted_role', v_role_value,
            'executor', v_current_user,
            'operation', TG_OP,
            'blocked', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      
      -- ALWAYS raise - this line is guaranteed to execute
      RAISE EXCEPTION 'SECURITY VIOLATION: Only service_role can assign staff roles. Current user: %, Attempted role: %', v_current_user, v_role_value;
    END IF;
  END IF;
  
  -- Non-staff roles (e.g., 'client') are allowed
  RETURN NEW;
END;
$$;

-- 2) Add explicit RLS policy for service_role on user_roles
-- First drop any existing service_role policies to avoid conflicts
DROP POLICY IF EXISTS "service_role_full_access" ON public.user_roles;

-- Create explicit service_role policy - do not assume bypass
CREATE POLICY "service_role_full_access"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON POLICY "service_role_full_access" ON public.user_roles IS 
'Explicit full access for service_role - required for edge functions and admin operations';