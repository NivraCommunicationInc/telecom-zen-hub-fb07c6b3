
-- ============================================================================
-- CANONICAL SERVICE ACTIVATION DATE — Business-controlled, not NOW()
-- ============================================================================
-- Adds an explicit business field `service_activated_at` on `orders` that
-- represents the REAL activation moment (controlled by Nivra Core / technician).
-- The billing cycle anchor MUST come from this field — never from NOW().
-- ============================================================================

-- 1) Add canonical business field on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_activated_by UUID,
  ADD COLUMN IF NOT EXISTS service_activation_source TEXT;

COMMENT ON COLUMN public.orders.service_activated_at IS
  'Canonical business activation timestamp. Set explicitly by Nivra Core / technician. Used as the unique anchor for billing_cycle_day, cycle_start_date and next_invoice_date. Never derived from NOW() at trigger time.';

COMMENT ON COLUMN public.orders.service_activated_by IS
  'User (admin / technician) who confirmed the service activation.';

COMMENT ON COLUMN public.orders.service_activation_source IS
  'Where the activation came from: core_admin, technician_app, automation, migration, etc.';

CREATE INDEX IF NOT EXISTS idx_orders_service_activated_at
  ON public.orders(service_activated_at)
  WHERE service_activated_at IS NOT NULL;

-- 2) Replace activation trigger to ONLY use orders.service_activated_at
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

  -- CANONICAL RULE: anchor MUST be the explicit business activation date.
  -- Fallback chain is deterministic and uses real recorded business events:
  --   1. orders.service_activated_at (preferred — set by Core / technician)
  --   2. orders.processed_at         (when Core marks order as activated)
  --   3. orders.shipped_at           (only valid for status = 'delivered')
  -- We NEVER fall back to NOW() — if none exist we abort the activation
  -- so it stays pending until a real business date is provided.
  v_activation_date := COALESCE(
    NEW.service_activated_at,
    NEW.processed_at,
    CASE WHEN NEW.status = 'delivered' THEN NEW.shipped_at ELSE NULL END
  );

  IF v_activation_date IS NULL THEN
    -- No real business date available → do NOT anchor cycle.
    -- The subscription stays pending until Core fills service_activated_at.
    RAISE NOTICE 'Order % reached status % without service_activated_at — subscription NOT activated.', NEW.id, NEW.status;
    RETURN NEW;
  END IF;

  -- If service_activated_at was not explicitly set, persist the resolved
  -- business date so it becomes canonical from now on.
  IF NEW.service_activated_at IS NULL THEN
    NEW.service_activated_at := v_activation_date;
    IF NEW.service_activation_source IS NULL THEN
      NEW.service_activation_source := 'derived_from_status_transition';
    END IF;
  END IF;

  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;

  -- 1) Activate associated subscription(s) anchored on the BUSINESS date
  UPDATE public.billing_subscriptions
  SET
    status               = 'active',
    billing_cycle_anchor = v_activation_date::DATE,
    cycle_start_date     = v_activation_date::DATE,
    cycle_end_date       = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at      = (v_activation_date + INTERVAL '1 month'),
    updated_at           = NOW()  -- audit-only timestamp, never used as anchor
  WHERE order_id = NEW.id
    AND status IN ('pending', 'incomplete');

  -- 2) Resolve account
  v_client_id := NEW.client_id;

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

-- 3) Also expose the canonical field via a tiny RPC for Core / Tech apps.
CREATE OR REPLACE FUNCTION public.set_order_service_activated(
  _order_id UUID,
  _activated_at TIMESTAMPTZ,
  _source TEXT DEFAULT 'core_admin'
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.orders;
BEGIN
  IF _activated_at IS NULL THEN
    RAISE EXCEPTION 'service_activated_at cannot be NULL';
  END IF;
  IF _activated_at > NOW() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'service_activated_at cannot be in the future';
  END IF;

  UPDATE public.orders
  SET
    service_activated_at      = _activated_at,
    service_activated_by      = auth.uid(),
    service_activation_source = COALESCE(_source, 'core_admin'),
    updated_at                = NOW()
  WHERE id = _order_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_service_activated(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_service_activated(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
