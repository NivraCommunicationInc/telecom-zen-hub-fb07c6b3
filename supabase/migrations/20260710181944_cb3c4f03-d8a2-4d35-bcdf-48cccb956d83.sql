
CREATE OR REPLACE FUNCTION public.internal_tickets_escalation_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ok text;
  v_target text;
BEGIN
  v_target := COALESCE(NEW.assigned_to_department, OLD.assigned_to_department);
  IF v_target IS DISTINCT FROM 'supervisor' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_ok := current_setting('app.escalation_write_ok', true);
  IF v_ok = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF current_setting('role', true) IN ('service_role')
     OR session_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION
    'INVARIANT-ESCALATION-SINGLE-DOOR: direct % on supervisor channel is forbidden. Route via supervisor-escalation-action.',
    TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;
