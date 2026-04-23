
-- ============================================================================
-- STRICT ACTIVATION ANCHOR — only orders.service_activated_at
-- ============================================================================
-- No fallback to processed_at or shipped_at.
-- If service_activated_at is NULL, the subscription stays pending and
-- billing_cycle_day / next_invoice_date / next_renewal_at remain NULL.
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

  -- CANONICAL RULE (STRICT):
  -- Only orders.service_activated_at can start the billing cycle.
  -- No fallback to processed_at or shipped_at.
  v_activation_date := NEW.service_activated_at;

  IF v_activation_date IS NULL THEN
    -- No business activation date → subscription stays pending,
    -- cycle dates remain NULL. processed_at / shipped_at are audit-only.
    RAISE NOTICE
      'Order % reached status % but service_activated_at is NULL — subscription NOT activated, cycle NOT started.',
      NEW.id, NEW.status;
    RETURN NEW;
  END IF;

  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;

  -- 1) Activate associated subscription(s), anchored on the BUSINESS date
  UPDATE public.billing_subscriptions
  SET
    status               = 'active',
    billing_cycle_anchor = v_activation_date::DATE,
    cycle_start_date     = v_activation_date::DATE,
    cycle_end_date       = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at      = (v_activation_date + INTERVAL '1 month'),
    updated_at           = NOW()  -- audit-only
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

COMMENT ON FUNCTION public.fn_activate_sub_on_order_activation() IS
  'STRICT canonical rule: a subscription is activated and a billing cycle is started ONLY when orders.service_activated_at is explicitly set. No fallback to processed_at, shipped_at, or NOW(). If service_activated_at is NULL, the subscription stays pending and billing_cycle_day / cycle_start_date / cycle_end_date / next_invoice_date / next_renewal_at remain NULL.';
