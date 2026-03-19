CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_value text;
  v_jwt_role text;
  v_service_context boolean;
  v_protected_staff_roles constant text[] := ARRAY[
    'admin',
    'employee',
    'technician',
    'field_sales',
    'supervisor',
    'sales',
    'support',
    'billing_admin',
    'techops',
    'kyc_agent'
  ];
BEGIN
  v_role_value := NEW.role::text;
  v_jwt_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), auth.role(), '');

  -- Metadata/portal updates are allowed when role itself is unchanged.
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Staff role assignment/modification must only come from trusted backend context.
  IF v_role_value = ANY(v_protected_staff_roles) THEN
    v_service_context :=
      v_jwt_role = 'service_role'
      OR current_user = 'service_role'
      OR session_user = 'postgres';

    IF NOT v_service_context THEN
      BEGIN
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES (
          'role_elevation_blocked',
          'critical',
          jsonb_build_object(
            'user_id', NEW.user_id,
            'attempted_role', v_role_value,
            'jwt_role', NULLIF(v_jwt_role, ''),
            'current_user', current_user,
            'session_user', session_user,
            'operation', TG_OP,
            'blocked', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      RAISE EXCEPTION 'SECURITY VIOLATION: Only trusted backend context can assign staff roles. JWT role: %, current_user: %, session_user: %, Attempted role: %',
        COALESCE(NULLIF(v_jwt_role, ''), 'none'),
        current_user,
        session_user,
        v_role_value;
    END IF;

    BEGIN
      INSERT INTO public.security_events (event_type, severity, details)
      VALUES (
        'role_change_allowed',
        'info',
        jsonb_build_object(
          'user_id', NEW.user_id,
          'role', v_role_value,
          'jwt_role', NULLIF(v_jwt_role, ''),
          'current_user', current_user,
          'session_user', session_user,
          'operation', TG_OP
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;