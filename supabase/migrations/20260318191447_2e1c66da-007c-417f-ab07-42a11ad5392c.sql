CREATE OR REPLACE FUNCTION public.fn_guard_billable_records_require_confirmed_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subscription_id uuid;
  v_order_status text;
BEGIN
  IF TG_TABLE_NAME = 'billing_invoices' THEN
    v_order_id := NEW.order_id;
    v_subscription_id := NEW.subscription_id;
  ELSIF TG_TABLE_NAME = 'billing_payments' THEN
    SELECT i.order_id, i.subscription_id
    INTO v_order_id, v_subscription_id
    FROM public.billing_invoices i
    WHERE i.id = NEW.invoice_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: invoice % does not exist for payment record', NEW.invoice_id;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_order_id IS NULL AND v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: billable records require order_id or subscription_id';
  END IF;

  IF v_order_id IS NOT NULL THEN
    SELECT o.status INTO v_order_status
    FROM public.orders o
    WHERE o.id = v_order_id;

    IF v_order_status IS NULL THEN
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: order % was not found for billable record', v_order_id;
    END IF;

    IF v_order_status NOT IN ('submitted', 'pending_admin_review', 'confirmed', 'completed') THEN
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: order status % is not billable', v_order_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_billable_order_state_invoices ON public.billing_invoices;
CREATE TRIGGER trg_guard_billable_order_state_invoices
BEFORE INSERT OR UPDATE OF order_id, subscription_id
ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_billable_records_require_confirmed_order();

DROP TRIGGER IF EXISTS trg_guard_billable_order_state_payments ON public.billing_payments;
CREATE TRIGGER trg_guard_billable_order_state_payments
BEFORE INSERT OR UPDATE OF invoice_id
ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_billable_records_require_confirmed_order();