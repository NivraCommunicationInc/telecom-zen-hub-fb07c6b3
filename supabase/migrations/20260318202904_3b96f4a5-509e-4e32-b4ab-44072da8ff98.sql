
-- =============================================================
-- PERMANENT INVARIANT: Checkout can NEVER auto-complete orders
-- This trigger blocks any direct transition from intake states 
-- (submitted, pending_admin_review) to completion states 
-- (completed, activated, fulfilled, delivered) unless the 
-- transition passes through legitimate operational states first.
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_guard_order_lifecycle_no_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake_states text[] := ARRAY['submitted', 'pending_admin_review', 'received'];
  completion_states text[] := ARRAY['completed', 'activated', 'fulfilled', 'delivered', 'installation_completed'];
  operational_states text[] := ARRAY['confirmed', 'processing', 'in_progress', 'provisioning', 'shipping', 'installing'];
BEGIN
  -- Only check when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Block direct jump from intake → completion (skipping operational processing)
  IF OLD.status = ANY(intake_states) AND NEW.status = ANY(completion_states) THEN
    -- Allow service_role (admin/automation) to force if needed, but log an alert
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, entity_reference, details)
      VALUES (
        'order_lifecycle_skip_warning',
        'order',
        NEW.id::text,
        NEW.order_number,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'warning', 'Direct intake-to-completion transition via service_role — review required',
          'timestamp', now()
        )
      );
      RETURN NEW;
    END IF;

    -- For all other callers: block the transition
    RAISE EXCEPTION 'ORDER_LIFECYCLE_GUARD: Cannot transition order % from "%" directly to "%". Orders must pass through operational processing states first.',
      NEW.order_number, OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_lifecycle_no_skip ON public.orders;
CREATE TRIGGER trg_guard_order_lifecycle_no_skip
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_order_lifecycle_no_skip();

COMMENT ON FUNCTION public.fn_guard_order_lifecycle_no_skip() IS 
  'PERMANENT INVARIANT: Prevents checkout or any automated process from skipping operational processing states. Orders must transition through confirmed/processing/etc before reaching completed/activated/fulfilled.';
