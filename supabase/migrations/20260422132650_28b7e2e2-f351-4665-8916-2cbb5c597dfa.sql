
-- Replace strict transition matrix for orders with admin-friendly logic.
-- Keeps terminals protected, but lets staff move between any operational state.
CREATE OR REPLACE FUNCTION public.is_valid_status_transition(p_domain text, p_old_status text, p_new_status text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  -- Idempotent
  IF p_old_status IS NOT DISTINCT FROM p_new_status THEN
    RETURN TRUE;
  END IF;

  IF p_domain = 'order' THEN
    -- Cancellation: allowed unless already terminal
    IF p_new_status = 'cancelled' THEN
      RETURN p_old_status NOT IN ('activated','completed','cancelled');
    END IF;
    -- Terminal states remain locked
    IF p_old_status IN ('activated','completed') THEN
      RETURN FALSE;
    END IF;
    -- 'cancelled' can only re-open via explicit admin path → block here
    IF p_old_status = 'cancelled' THEN
      RETURN FALSE;
    END IF;
    -- Otherwise admins/staff are free to apply any operational status
    RETURN TRUE;
  END IF;

  IF p_domain = 'shipment' THEN
    IF p_old_status IN ('delivered','cancelled','returned') THEN
      RETURN FALSE;
    END IF;
    IF p_new_status = 'cancelled' THEN
      RETURN p_old_status NOT IN ('delivered','returned');
    END IF;
    RETURN (p_old_status, p_new_status) IN (
      ('pending','label_created'),
      ('pending','shipped'),
      ('label_created','shipped'),
      ('shipped','in_transit'),
      ('shipped','out_for_delivery'),
      ('shipped','delivered'),
      ('in_transit','out_for_delivery'),
      ('in_transit','delivered'),
      ('out_for_delivery','delivered'),
      ('delivered','returned')
    );
  END IF;

  IF p_domain = 'activation' THEN
    IF p_old_status IN ('completed','cancelled','rejected') THEN
      RETURN FALSE;
    END IF;
    IF p_new_status IN ('cancelled','rejected') THEN
      RETURN TRUE;
    END IF;
    RETURN (p_old_status, p_new_status) IN (
      ('pending','in_progress'),
      ('pending','started'),
      ('pending','assigned'),
      ('assigned','in_progress'),
      ('assigned','started'),
      ('started','in_progress'),
      ('in_progress','completed'),
      ('started','completed')
    );
  END IF;

  RETURN TRUE;
END;
$function$;

-- Relax the lifecycle no-skip guard: Nivra Core admins can jump intake → completion
-- (the DB transition validator above already protects terminals).
CREATE OR REPLACE FUNCTION public.fn_guard_order_lifecycle_no_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Always allow: admins/staff have full lifecycle authority.
  -- Terminal protection remains in fn_guard_order_status_transition.
  RETURN NEW;
END;
$function$;
