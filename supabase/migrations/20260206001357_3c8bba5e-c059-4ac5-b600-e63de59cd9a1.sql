-- Fix the validate_role_change function to allow updating non-role fields
CREATE OR REPLACE FUNCTION validate_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_role_value text;
  v_current_user text;
BEGIN
  -- Get the role being set
  v_role_value := NEW.role::text;
  v_current_user := current_user;
  
  -- IMPORTANT: If this is an UPDATE and the role itself is NOT changing,
  -- allow it (this permits updating flags like require_password_change)
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is a staff role
  IF v_role_value IN ('admin', 'employee', 'technician') THEN
    -- ONLY service_role can set staff roles - this is the ONLY allowed path
    IF v_current_user = 'service_role' THEN
      -- Safe logging attempt
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
        NULL;
      END;
      
      RETURN NEW;
    ELSE
      -- HARD BLOCK - non-service_role attempting staff role
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
      
      RAISE EXCEPTION 'SECURITY VIOLATION: Only service_role can assign staff roles. Current user: %, Attempted role: %', v_current_user, v_role_value;
    END IF;
  END IF;
  
  -- Non-staff roles (e.g., 'client') are allowed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;