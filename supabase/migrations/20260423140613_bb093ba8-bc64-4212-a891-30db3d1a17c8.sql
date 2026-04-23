
-- ═══════════════════════════════════════════════════════════════════════
-- Activation-anchored billing cycle
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_date TIMESTAMPTZ;
  v_activation_day INT;
  v_account_id UUID;
  v_client_id UUID;
BEGIN
  -- Only trigger on transition to a service-active state
  IF NEW.status NOT IN ('delivered', 'activated', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Avoid re-running if status didn't actually change to one of these
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Anchor date = NOW() (real activation moment)
  v_activation_date := NOW();
  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;

  -- 1) Activate associated subscription(s) and anchor cycle on activation date
  UPDATE billing_subscriptions
  SET 
    status = 'active',
    billing_cycle_anchor = v_activation_date::DATE,
    cycle_start_date = v_activation_date::DATE,
    cycle_end_date = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at = (v_activation_date + INTERVAL '1 month'),
    updated_at = NOW()
  WHERE order_id = NEW.id
    AND status IN ('pending', 'incomplete');

  -- 2) Resolve client and account
  v_client_id := NEW.client_id;
  
  SELECT a.id INTO v_account_id
  FROM accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- 3) Update account billing cycle to match activation date
  IF v_account_id IS NOT NULL THEN
    UPDATE accounts
    SET 
      billing_cycle_day = v_activation_day,
      billing_anchor_date = v_activation_date::DATE,
      next_invoice_date = (v_activation_date + INTERVAL '1 month')::DATE,
      updated_at = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON public.orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_activate_sub_on_order_activation();
