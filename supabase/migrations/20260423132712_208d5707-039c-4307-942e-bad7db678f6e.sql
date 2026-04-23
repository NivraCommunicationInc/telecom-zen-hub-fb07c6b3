-- 1) Stop initial-invoice paid trigger from auto-activating the subscription.
--    It must only link last_invoice_id and leave status='pending' until the order is delivered/activated.
CREATE OR REPLACE FUNCTION public.update_subscription_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  payment_confirmed_at TIMESTAMPTZ;
  new_cycle_start DATE;
  new_cycle_end DATE;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'paid' THEN

    -- For RENEWAL invoices: keep prior behaviour (reactivate already-active sub for next cycle).
    IF NEW.type = 'renewal' THEN
      UPDATE billing_subscriptions
      SET
        status = 'active',
        cycle_start_date = NEW.cycle_start_date,
        cycle_end_date = NEW.cycle_end_date,
        last_invoice_id = NEW.id,
        updated_at = NOW()
      WHERE id = NEW.subscription_id;

      RAISE NOTICE '[billing-trigger] Renewal invoice % paid. Subscription % reactivated cycle % to %',
        NEW.invoice_number, NEW.subscription_id, NEW.cycle_start_date, NEW.cycle_end_date;

      RETURN NEW;
    END IF;

    -- For INITIAL invoices: DO NOT activate. Subscription must remain pending
    -- until order is delivered/activated. We only link the invoice and clear cycle dates
    -- so they will be assigned at true activation time.
    payment_confirmed_at := COALESCE(NEW.paid_at, NOW());
    new_cycle_start := payment_confirmed_at::DATE;
    new_cycle_end := (payment_confirmed_at + INTERVAL '30 days')::DATE;

    -- Keep invoice cycle stamped from payment date (snapshot for the invoice itself)
    NEW.cycle_start_date := new_cycle_start;
    NEW.cycle_end_date := new_cycle_end;

    UPDATE billing_subscriptions
    SET
      last_invoice_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.subscription_id
      AND status = 'pending';

    RAISE NOTICE '[billing-trigger] Initial invoice % paid at %. Subscription % kept pending until order activation.',
      NEW.invoice_number, payment_confirmed_at, NEW.subscription_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Update activation trigger so it sets cycle dates when transitioning pending -> active
CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_activated_at TIMESTAMPTZ;
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  IF NEW.status IN ('activated', 'delivered')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status NOT IN ('activated', 'delivered') THEN

    v_activated_at := NOW();
    v_cycle_start := v_activated_at::DATE;
    v_cycle_end := (v_activated_at + INTERVAL '30 days')::DATE;

    UPDATE billing_subscriptions
    SET status = 'active',
        cycle_start_date = v_cycle_start,
        cycle_end_date = v_cycle_end,
        updated_at = v_activated_at
    WHERE order_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Backfill Vincent: order #79485 is only 'shipped' so subscription must be pending again.
UPDATE billing_subscriptions s
SET status = 'pending', updated_at = NOW()
FROM orders o
WHERE s.order_id = o.id
  AND o.status NOT IN ('activated','delivered')
  AND s.status = 'active'
  AND s.id = 'ba54696b-19f9-4506-848c-a3a68fc7c483';