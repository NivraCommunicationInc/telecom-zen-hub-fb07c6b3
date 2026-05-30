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
  v_order_source text;
  v_payment_method text;
  v_is_staff boolean := false;
BEGIN
  -- Staff override: admin / employee / supervisor / billing_admin can always bill
  IF auth.uid() IS NOT NULL THEN
    v_is_staff := (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'employee'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    );
  END IF;

  IF TG_TABLE_NAME = 'billing_invoices' THEN
    v_order_id := NEW.order_id;
    v_subscription_id := NEW.subscription_id;
  ELSIF TG_TABLE_NAME = 'billing_payments' THEN
    SELECT i.order_id, i.subscription_id
    INTO v_order_id, v_subscription_id
    FROM public.billing_invoices i
    WHERE i.id = NEW.invoice_id;

    IF NOT FOUND THEN
      IF v_is_staff THEN
        RAISE WARNING 'BILLING_GUARD_WARN: invoice % does not exist for payment record (staff override)', NEW.invoice_id;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: invoice % does not exist for payment record', NEW.invoice_id;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_order_id IS NULL AND v_subscription_id IS NULL THEN
    IF v_is_staff THEN
      RAISE WARNING 'BILLING_GUARD_WARN: billable record without order_id/subscription_id (staff override)';
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: billable records require order_id or subscription_id';
  END IF;

  IF v_order_id IS NOT NULL THEN
    SELECT o.status, o.source, o.payment_method
    INTO v_order_status, v_order_source, v_payment_method
    FROM public.orders o
    WHERE o.id = v_order_id;

    IF v_order_status IS NULL THEN
      IF v_is_staff THEN
        RAISE WARNING 'BILLING_GUARD_WARN: order % was not found (staff override)', v_order_id;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: order % was not found for billable record', v_order_id;
    END IF;

    IF v_order_source = 'field_sales'
       AND v_payment_method = 'card_manual'
       AND v_order_status IN ('pending', 'pending_payment', 'submitted') THEN
      RETURN NEW;
    END IF;

    IF v_order_status NOT IN ('submitted', 'pending_admin_review', 'confirmed', 'completed', 'activated', 'delivered') THEN
      IF v_is_staff THEN
        RAISE WARNING 'BILLING_GUARD_WARN: order status % is not normally billable (staff override)', v_order_status;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BILLING_GUARD_BLOCKED: order status % is not billable', v_order_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;