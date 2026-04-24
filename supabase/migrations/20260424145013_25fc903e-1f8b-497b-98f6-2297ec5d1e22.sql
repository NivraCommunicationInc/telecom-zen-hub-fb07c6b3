-- ============================================================================
-- Hardening: when an order transitions to 'activated' but service_activated_at
-- is NULL (legacy code path or manual UPDATE), auto-stamp it to NOW() so the
-- billing cycle starts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_date TIMESTAMPTZ;
  v_activation_day  INT;
  v_account_id      UUID;
  v_client_id       UUID;
BEGIN
  -- Only act when status transitions into a service-active state
  IF NEW.status NOT IN ('delivered', 'activated', 'completed') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Auto-stamp service_activated_at when an admin moves the order to
  -- 'activated' without setting it explicitly. Fixes the case where the
  -- Core "Activer" button only updated status and left the cycle un-started.
  IF NEW.service_activated_at IS NULL AND NEW.status = 'activated' THEN
    NEW.service_activated_at := NOW();
    NEW.service_activation_source :=
      COALESCE(NEW.service_activation_source, 'trigger_auto_activated');
  END IF;

  v_activation_date := NEW.service_activated_at;

  IF v_activation_date IS NULL THEN
    RAISE NOTICE
      'Order % reached status % but service_activated_at is NULL — subscription NOT activated, cycle NOT started.',
      NEW.id, NEW.status;
    RETURN NEW;
  END IF;

  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;
  v_client_id := NEW.client_id;

  -- 1) Activate associated subscription(s), anchored on the BUSINESS date
  UPDATE public.billing_subscriptions
  SET
    status                = 'active',
    billing_cycle_anchor  = v_activation_date::DATE,
    cycle_start_date      = v_activation_date::DATE,
    cycle_end_date        = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at       = (v_activation_date + INTERVAL '1 month'),
    auto_billing_enabled  = TRUE,
    updated_at            = NOW()
  WHERE order_id = NEW.id
    AND status IN ('pending', 'incomplete');

  -- 2) Resolve account
  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- 3) Anchor account billing cycle on BUSINESS date
  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET
      billing_cycle_day   = v_activation_day,
      billing_anchor_date = v_activation_date::DATE,
      next_invoice_date   = (v_activation_date + INTERVAL '1 month')::DATE,
      updated_at          = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_activate_sub_on_order_activation() IS
  'Activates the linked billing_subscriptions and anchors the account cycle when an order reaches a service-active status. If service_activated_at is NULL when status becomes activated, it is auto-stamped to NOW() so the billing cycle is guaranteed to start.';

-- BEFORE UPDATE so the auto-stamped NEW.service_activated_at persists.
DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON public.orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_activate_sub_on_order_activation();

-- ============================================================================
-- Backfill: orders already at status='activated' whose subscription never got
-- a cycle_start_date (because legacy code path skipped service_activated_at).
-- ============================================================================

UPDATE public.orders
SET
  service_activated_at      = COALESCE(service_activated_at, processed_at, updated_at, NOW()),
  service_activation_source = COALESCE(service_activation_source, 'backfill_2026_04_24')
WHERE status = 'activated'
  AND service_activated_at IS NULL;

UPDATE public.billing_subscriptions bs
SET
  status                = 'active',
  cycle_start_date      = COALESCE(bs.cycle_start_date, o.service_activated_at::DATE, NOW()::DATE),
  cycle_end_date        = COALESCE(bs.cycle_end_date,
                                    (COALESCE(o.service_activated_at, NOW()) + INTERVAL '1 month')::DATE),
  billing_cycle_anchor  = COALESCE(bs.billing_cycle_anchor, o.service_activated_at::DATE, NOW()::DATE),
  next_renewal_at       = COALESCE(bs.next_renewal_at,
                                    COALESCE(o.service_activated_at, NOW()) + INTERVAL '1 month'),
  auto_billing_enabled  = COALESCE(bs.auto_billing_enabled, TRUE),
  updated_at            = NOW()
FROM public.orders o
WHERE bs.order_id = o.id
  AND o.status = 'activated'
  AND (bs.cycle_start_date IS NULL OR bs.status <> 'active');