-- =====================================================
-- FIX 1: Recreate generate_account_renewal_invoice WITHOUT ::text casts
-- FIX 3: Set subscription_id on renewal invoices to pass guard trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_account_renewal_invoice(
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account       record;
  v_customer_id   uuid;
  v_invoice_id    uuid;
  v_invoice_number text;
  v_subtotal      numeric(12,2) := 0;
  v_tps           numeric(12,2);
  v_tvq           numeric(12,2);
  v_total         numeric(12,2);
  v_cycle_start   date;
  v_cycle_end     date;
  v_due_date      date;
  v_sub           record;
  v_svc           record;
  v_line_count    int := 0;
  v_sub_has_services boolean;
  v_first_sub_id  uuid;
  v_now           timestamptz := now();
BEGIN
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ACCOUNT_NOT_FOUND');
  END IF;

  SELECT bc.id INTO v_customer_id
  FROM billing_customers bc
  WHERE bc.user_id = v_account.client_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NO_BILLING_CUSTOMER');
  END IF;

  v_cycle_start := v_account.next_invoice_date::date;
  IF v_cycle_start IS NULL THEN
    v_cycle_start := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      COALESCE(v_account.billing_cycle_day, 1)
    );
  END IF;
  v_cycle_end := (v_cycle_start + interval '30 days')::date;
  v_due_date  := v_cycle_start;

  IF EXISTS (
    SELECT 1 FROM billing_invoices
    WHERE customer_id = v_customer_id
      AND type = 'renewal'
      AND cycle_start_date = v_cycle_start
      AND status NOT IN ('void', 'cancelled')
  ) THEN
    RETURN jsonb_build_object('error', 'RENEWAL_ALREADY_EXISTS', 'cycle_start', v_cycle_start);
  END IF;

  SELECT generate_billing_invoice_number() INTO v_invoice_number;

  SELECT bs.id INTO v_first_sub_id
  FROM billing_subscriptions bs
  WHERE bs.customer_id = v_customer_id AND bs.status = 'active'
  ORDER BY bs.created_at ASC
  LIMIT 1;

  IF v_first_sub_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NO_ACTIVE_SUBSCRIPTIONS');
  END IF;

  FOR v_sub IN
    SELECT bs.*
    FROM billing_subscriptions bs
    WHERE bs.customer_id = v_customer_id
      AND bs.status = 'active'
  LOOP
    v_sub_has_services := false;
    FOR v_svc IN
      SELECT * FROM billing_subscription_services
      WHERE subscription_id = v_sub.id AND is_active = true
    LOOP
      v_sub_has_services := true;
      v_subtotal := v_subtotal + (v_svc.unit_price * COALESCE(v_svc.quantity, 1));
      v_line_count := v_line_count + 1;
    END LOOP;
    IF NOT v_sub_has_services THEN
      v_subtotal := v_subtotal + v_sub.plan_price;
      v_line_count := v_line_count + 1;
    END IF;
  END LOOP;

  IF v_subtotal <= 0 THEN
    RETURN jsonb_build_object('error', 'NO_ACTIVE_SERVICES', 'subtotal', 0);
  END IF;

  v_tps := round(v_subtotal * 0.05, 2);
  v_tvq := round(v_subtotal * 0.09975, 2);
  v_total := round(v_subtotal + v_tps + v_tvq, 2);

  INSERT INTO billing_invoices (
    customer_id, subscription_id, invoice_number, type, subtotal, tps_amount, tvq_amount,
    total, balance_due, amount_paid, currency, payment_method, status,
    cycle_start_date, cycle_end_date, due_date,
    billing_snapshot_account_number,
    created_at
  ) VALUES (
    v_customer_id, v_first_sub_id, v_invoice_number, 'renewal', v_subtotal, v_tps, v_tvq,
    v_total, v_total, 0, 'CAD', 'interac', 'pending',
    v_cycle_start, v_cycle_end, v_due_date,
    v_account.account_number,
    v_now
  )
  RETURNING id INTO v_invoice_id;

  v_line_count := 0;
  FOR v_sub IN
    SELECT bs.*
    FROM billing_subscriptions bs
    WHERE bs.customer_id = v_customer_id
      AND bs.status = 'active'
  LOOP
    DECLARE
      v_sub_has_svc boolean := false;
    BEGIN
      FOR v_svc IN
        SELECT * FROM billing_subscription_services
        WHERE subscription_id = v_sub.id AND is_active = true
      LOOP
        v_sub_has_svc := true;
        INSERT INTO billing_invoice_lines (
          invoice_id, description, unit_price, quantity, line_total, line_type
        ) VALUES (
          v_invoice_id,
          v_svc.service_name || ' – Renouvellement 30 jours',
          v_svc.unit_price,
          COALESCE(v_svc.quantity, 1),
          v_svc.unit_price * COALESCE(v_svc.quantity, 1),
          'service'
        );
        v_line_count := v_line_count + 1;
      END LOOP;
      IF NOT v_sub_has_svc THEN
        INSERT INTO billing_invoice_lines (
          invoice_id, description, unit_price, quantity, line_total, line_type
        ) VALUES (
          v_invoice_id,
          v_sub.plan_name || ' – Renouvellement 30 jours',
          v_sub.plan_price,
          1,
          v_sub.plan_price,
          'service'
        );
        v_line_count := v_line_count + 1;
      END IF;
    END;
  END LOOP;

  UPDATE accounts
  SET next_invoice_date = (v_cycle_start + interval '30 days')::date,
      updated_at = v_now
  WHERE id = p_account_id;

  UPDATE billing_subscriptions
  SET cycle_start_date = v_cycle_start,
      cycle_end_date = (v_cycle_start + interval '30 days')::date,
      next_renewal_at = (v_cycle_start + interval '27 days')::timestamptz,
      updated_at = v_now
  WHERE customer_id = v_customer_id
    AND status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'subtotal', v_subtotal,
    'tps', v_tps,
    'tvq', v_tvq,
    'total', v_total,
    'cycle_start', v_cycle_start,
    'cycle_end', v_cycle_end,
    'lines', v_line_count
  );
END;
$$;

-- =====================================================
-- FIX 2: Fix fn_generate_subscription_renewal ::text cast
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_generate_subscription_renewal(
  p_subscription_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_invoice_number text;
  v_invoice_id uuid;
  v_customer_id uuid;
  v_subtotal numeric;
  v_tps numeric;
  v_tvq numeric;
  v_total numeric;
  v_new_cycle_start date;
  v_new_cycle_end date;
  v_due_date date;
  v_existing_invoice_id uuid;
  v_promo_discount numeric := 0;
  v_order_snapshot jsonb;
  v_renewal_count int;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'subscription_not_found_or_inactive');
  END IF;

  v_customer_id := v_sub.billing_customer_id;
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM public.billing_customers WHERE user_id = v_sub.user_id LIMIT 1;
    IF v_customer_id IS NOT NULL THEN
      UPDATE public.subscriptions SET billing_customer_id = v_customer_id WHERE id = p_subscription_id;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'reason', 'no_billing_customer');
  END IF;

  v_new_cycle_start := v_sub.next_billing_date;
  v_new_cycle_end := (v_sub.next_billing_date + INTERVAL '30 days')::date;
  v_due_date := v_sub.next_billing_date;

  SELECT id INTO v_existing_invoice_id
  FROM public.billing_invoices
  WHERE customer_id = v_customer_id
    AND cycle_start_date = v_new_cycle_start
    AND type = 'renewal'
    AND status NOT IN ('void', 'cancelled')
  LIMIT 1;

  IF v_existing_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'invoice_already_exists', 'invoice_id', v_existing_invoice_id);
  END IF;

  IF v_sub.order_id IS NOT NULL THEN
    SELECT pricing_snapshot INTO v_order_snapshot FROM public.orders WHERE id = v_sub.order_id;
    IF v_order_snapshot IS NOT NULL AND v_order_snapshot -> 'promo_applied' IS NOT NULL THEN
      IF (v_order_snapshot -> 'promo_applied' ->> 'duration') = 'limited' THEN
        SELECT count(*) INTO v_renewal_count
        FROM public.billing_invoices
        WHERE customer_id = v_customer_id
          AND type = 'renewal'
          AND status NOT IN ('void', 'cancelled');
        IF (v_renewal_count + 1) < (v_order_snapshot -> 'promo_applied' ->> 'duration_months')::int THEN
          v_promo_discount := COALESCE((v_order_snapshot -> 'promo_applied' ->> 'discount_amount')::numeric, 0);
        END IF;
      END IF;
    END IF;
  END IF;

  v_subtotal := GREATEST(0, COALESCE(v_sub.monthly_price, v_sub.amount, 0) - v_promo_discount);
  v_tps := ROUND(v_subtotal * 0.05, 2);
  v_tvq := ROUND(v_subtotal * 0.09975, 2);
  v_total := ROUND(v_subtotal + v_tps + v_tvq, 2);

  SELECT public.generate_billing_invoice_number() INTO v_invoice_number;

  INSERT INTO public.billing_invoices (
    subscription_id, customer_id, invoice_number, type,
    subtotal, tps_amount, tvq_amount, total, balance_due, amount_paid,
    currency, payment_method, status,
    cycle_start_date, cycle_end_date, due_date
  ) VALUES (
    p_subscription_id, v_customer_id, v_invoice_number, 'renewal',
    v_subtotal, v_tps, v_tvq, v_total, v_total, 0,
    'CAD', 'interac', 'pending',
    v_new_cycle_start, v_new_cycle_end, v_due_date
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total, line_type
  ) VALUES (
    v_invoice_id,
    COALESCE(v_sub.plan_name, v_sub.service_type, 'Service') || ' – Renouvellement 30 jours',
    v_subtotal, 1, v_subtotal, 'service'
  );

  UPDATE public.subscriptions
  SET next_billing_date = v_new_cycle_end,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total', v_total,
    'cycle_start', v_new_cycle_start,
    'cycle_end', v_new_cycle_end
  );
END;
$$;

-- =====================================================
-- FIX 7: Auto-cancel subscriptions when orders are cancelled
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_cancel_sub_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'canceled') 
     AND OLD.status NOT IN ('cancelled', 'canceled') THEN
    UPDATE billing_subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id
      AND status IN ('active', 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_sub_on_order_cancel ON orders;
CREATE TRIGGER trg_cancel_sub_on_order_cancel
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_cancel_sub_on_order_cancel();