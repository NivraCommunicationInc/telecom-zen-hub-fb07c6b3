-- Fix Bug 1: RPC generate_account_renewal_invoice — date = text type mismatch
-- The idempotency check compared date column to text: cycle_start_date = v_cycle_start::text
-- The INSERT cast date values to text: v_cycle_start::text, v_cycle_end::text, v_due_date::text
-- Fix: remove all ::text casts so date columns receive proper date values

CREATE OR REPLACE FUNCTION public.generate_account_renewal_invoice(p_account_id uuid)
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

  -- Idempotency: compare date = date (NOT date = text)
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

  -- INSERT: pass date values directly (no ::text cast)
  INSERT INTO billing_invoices (
    customer_id, invoice_number, type, subtotal, tps_amount, tvq_amount,
    total, balance_due, amount_paid, currency, payment_method, status,
    cycle_start_date, cycle_end_date, due_date,
    billing_snapshot_account_number,
    created_at
  ) VALUES (
    v_customer_id, v_invoice_number, 'renewal', v_subtotal, v_tps, v_tvq,
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
          v_svc.service_name || E' \u2013 Renouvellement 30 jours',
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
          v_sub.plan_name || E' \u2013 Renouvellement 30 jours',
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
$$