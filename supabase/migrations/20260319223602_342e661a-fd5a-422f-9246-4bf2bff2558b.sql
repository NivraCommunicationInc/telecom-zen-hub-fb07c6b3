CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_role_value text;
  v_jwt_role text;
  v_service_context boolean;
BEGIN
  v_role_value := NEW.role::text;
  v_jwt_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), auth.role(), '');

  -- Allow metadata-only updates when role is unchanged
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Allow only trusted backend context for internal staff roles
  IF v_role_value IN ('admin', 'employee', 'technician') THEN
    v_service_context := (v_jwt_role = 'service_role') OR (v_jwt_role = '' AND session_user = 'postgres');

    IF v_service_context THEN
      BEGIN
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'role_change_allowed',
          'info',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'role', v_role_value,
            'jwt_role', NULLIF(v_jwt_role, ''),
            'session_user', session_user,
            'operation', TG_OP
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      RETURN NEW;
    ELSE
      BEGIN
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'role_elevation_blocked',
          'critical',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'attempted_role', v_role_value,
            'jwt_role', NULLIF(v_jwt_role, ''),
            'session_user', session_user,
            'operation', TG_OP,
            'blocked', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      RAISE EXCEPTION 'SECURITY VIOLATION: Only trusted backend context can assign staff roles. JWT role: %, session_user: %, Attempted role: %',
        COALESCE(NULLIF(v_jwt_role, ''), 'none'),
        session_user,
        v_role_value;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;