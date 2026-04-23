-- ═══════════════════════════════════════════════════════════════════════
-- GLOBAL SYSTEM FIX v2: Make cycle dates nullable + backfill + guard
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0) Allow NULL cycle dates while subscription not active ──
ALTER TABLE public.billing_subscriptions 
  ALTER COLUMN cycle_start_date DROP NOT NULL,
  ALTER COLUMN cycle_end_date DROP NOT NULL;

-- ── 1) BACKFILL: clear fake cycle dates on non-active subscriptions ──
UPDATE billing_subscriptions bs
SET 
  cycle_start_date = NULL,
  cycle_end_date = NULL,
  next_renewal_at = NULL,
  billing_cycle_anchor = NULL,
  updated_at = NOW()
WHERE bs.status::text IN ('pending', 'incomplete', 'suspended', 'past_due')
  AND (bs.cycle_start_date IS NOT NULL OR bs.cycle_end_date IS NOT NULL OR bs.next_renewal_at IS NOT NULL);

-- ── 2) BACKFILL: subscriptions marked active but linked order NOT activated → demote ──
UPDATE billing_subscriptions bs
SET 
  status = 'pending'::billing_subscription_status,
  cycle_start_date = NULL,
  cycle_end_date = NULL,
  next_renewal_at = NULL,
  billing_cycle_anchor = NULL,
  updated_at = NOW()
FROM orders o
WHERE bs.order_id = o.id
  AND bs.status::text = 'active'
  AND o.status NOT IN ('activated', 'delivered', 'completed');

-- ── 3) BACKFILL: clear billing cycle on accounts with no real activation ──
UPDATE accounts a
SET 
  billing_cycle_day = NULL,
  billing_anchor_date = NULL,
  next_invoice_date = NULL,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM billing_subscriptions bs
  JOIN billing_customers bc ON bc.id = bs.customer_id
  WHERE bc.user_id = a.client_id
    AND bs.status::text = 'active'
    AND bs.cycle_start_date IS NOT NULL
)
AND (a.billing_cycle_day IS NOT NULL OR a.billing_anchor_date IS NOT NULL OR a.next_invoice_date IS NOT NULL);

-- ── 4) GUARD TRIGGER: prevent fake cycle dates on non-active subscriptions ──
CREATE OR REPLACE FUNCTION public.fn_guard_subscription_cycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow cycle dates when status = 'active'
  IF NEW.status::text IN ('pending', 'incomplete', 'suspended', 'past_due') THEN
    NEW.cycle_start_date := NULL;
    NEW.cycle_end_date := NULL;
    NEW.next_renewal_at := NULL;
    NEW.billing_cycle_anchor := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_subscription_cycle_dates ON public.billing_subscriptions;
CREATE TRIGGER trg_guard_subscription_cycle_dates
BEFORE INSERT OR UPDATE ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_subscription_cycle_dates();

-- ── 5) GUARD TRIGGER on accounts: clear billing cycle if no active subscription ──
CREATE OR REPLACE FUNCTION public.fn_guard_account_billing_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_sub BOOLEAN;
BEGIN
  -- If billing cycle fields are being SET, verify there's an active subscription
  IF (NEW.billing_cycle_day IS NOT NULL OR NEW.next_invoice_date IS NOT NULL OR NEW.billing_anchor_date IS NOT NULL) THEN
    SELECT EXISTS(
      SELECT 1 FROM billing_subscriptions bs
      JOIN billing_customers bc ON bc.id = bs.customer_id
      WHERE bc.user_id = NEW.client_id
        AND bs.status::text = 'active'
        AND bs.cycle_start_date IS NOT NULL
    ) INTO v_has_active_sub;

    IF NOT v_has_active_sub THEN
      NEW.billing_cycle_day := NULL;
      NEW.billing_anchor_date := NULL;
      NEW.next_invoice_date := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_account_billing_cycle ON public.accounts;
CREATE TRIGGER trg_guard_account_billing_cycle
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_account_billing_cycle();
