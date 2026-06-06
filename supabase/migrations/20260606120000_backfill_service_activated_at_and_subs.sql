-- ============================================================================
-- BACKFILL: service_activated_at + billing subscription activation
-- ============================================================================
-- Orders that are in a terminal status (activated/delivered/completed/
-- installation_completed) but have no service_activated_at → set it from
-- the best available business date, then activate the linked subscription.
-- ============================================================================

-- Also teach the trigger to handle installation_completed
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
  IF NEW.status NOT IN ('delivered', 'activated', 'completed', 'installation_completed') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_activation_date := COALESCE(
    NEW.service_activated_at,
    NEW.processed_at,
    CASE WHEN NEW.status IN ('delivered', 'installation_completed') THEN NEW.shipped_at ELSE NULL END
  );

  IF v_activation_date IS NULL THEN
    RAISE NOTICE 'Order % reached status % without service_activated_at — subscription NOT activated.', NEW.id, NEW.status;
    RETURN NEW;
  END IF;

  IF NEW.service_activated_at IS NULL THEN
    NEW.service_activated_at := v_activation_date;
    IF NEW.service_activation_source IS NULL THEN
      NEW.service_activation_source := 'derived_from_status_transition';
    END IF;
  END IF;

  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;

  UPDATE public.billing_subscriptions
  SET
    status               = 'active',
    billing_cycle_anchor = v_activation_date::DATE,
    cycle_start_date     = v_activation_date::DATE,
    cycle_end_date       = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at      = (v_activation_date + INTERVAL '1 month'),
    updated_at           = NOW()
  WHERE order_id = NEW.id
    AND status IN ('pending', 'incomplete');

  v_client_id := NEW.client_id;

  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

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

DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON public.orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_activate_sub_on_order_activation();

-- ── BACKFILL ────────────────────────────────────────────────────────────────

-- Step 1: stamp service_activated_at on terminal orders that don't have it
UPDATE public.orders
SET
  service_activated_at      = COALESCE(processed_at, shipped_at, updated_at, created_at),
  service_activation_source = 'backfill_migration',
  updated_at                = NOW()
WHERE status IN ('activated', 'delivered', 'completed', 'installation_completed')
  AND service_activated_at IS NULL;

-- Step 2: activate subscriptions linked to those orders (now have service_activated_at)
UPDATE public.billing_subscriptions bs
SET
  status               = 'active',
  billing_cycle_anchor = o.service_activated_at::DATE,
  cycle_start_date     = o.service_activated_at::DATE,
  cycle_end_date       = (o.service_activated_at + INTERVAL '1 month')::DATE,
  next_renewal_at      = (o.service_activated_at + INTERVAL '1 month'),
  updated_at           = NOW()
FROM public.orders o
WHERE bs.order_id = o.id
  AND o.status IN ('activated', 'delivered', 'completed', 'installation_completed')
  AND o.service_activated_at IS NOT NULL
  AND (bs.status IN ('pending', 'incomplete') OR bs.cycle_end_date IS NULL);

-- Step 3: update account billing cycle for affected clients
UPDATE public.accounts a
SET
  billing_cycle_day   = EXTRACT(DAY FROM o.service_activated_at)::INT,
  billing_anchor_date = o.service_activated_at::DATE,
  next_invoice_date   = (o.service_activated_at + INTERVAL '1 month')::DATE,
  updated_at          = NOW()
FROM public.billing_subscriptions bs
JOIN public.billing_customers bc ON bc.id = bs.customer_id
JOIN public.orders o ON o.id = bs.order_id
WHERE a.client_id = bc.user_id
  AND bs.status = 'active'
  AND bs.cycle_start_date IS NOT NULL
  AND a.next_invoice_date IS NULL;
