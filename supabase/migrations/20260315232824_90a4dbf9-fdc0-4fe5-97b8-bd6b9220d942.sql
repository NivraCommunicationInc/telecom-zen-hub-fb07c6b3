
-- ============================================================
-- STABILIZATION DAY 2: Billing Automation Engine
-- DB function to generate recurring invoices from subscriptions
-- ============================================================

-- 1. Add billing_customer_id to subscriptions for invoice linkage
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_customer_id uuid REFERENCES public.billing_customers(id) ON DELETE SET NULL;

-- 2. Core renewal function: processes one subscription
CREATE OR REPLACE FUNCTION public.fn_generate_subscription_renewal(p_subscription_id uuid)
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
  -- Fetch subscription
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'subscription_not_found_or_inactive');
  END IF;

  -- Determine billing customer
  v_customer_id := v_sub.billing_customer_id;
  IF v_customer_id IS NULL THEN
    -- Try to resolve from billing_customers via user_id
    SELECT id INTO v_customer_id FROM public.billing_customers WHERE user_id = v_sub.user_id LIMIT 1;
    IF v_customer_id IS NOT NULL THEN
      UPDATE public.subscriptions SET billing_customer_id = v_customer_id WHERE id = p_subscription_id;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'reason', 'no_billing_customer');
  END IF;

  -- Calculate cycle dates
  v_new_cycle_start := v_sub.next_billing_date;
  v_new_cycle_end := v_sub.next_billing_date + INTERVAL '30 days';
  v_due_date := v_sub.next_billing_date;

  -- Idempotency: check if invoice already exists for this cycle
  SELECT id INTO v_existing_invoice_id
  FROM public.billing_invoices
  WHERE customer_id = v_customer_id
    AND cycle_start_date = v_new_cycle_start::text
    AND type = 'renewal'
    AND status NOT IN ('void', 'cancelled')
  LIMIT 1;

  IF v_existing_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'invoice_already_exists', 'invoice_id', v_existing_invoice_id);
  END IF;

  -- Check promo duration
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

  -- Calculate amounts (Quebec taxes)
  v_subtotal := GREATEST(0, COALESCE(v_sub.monthly_price, v_sub.amount, 0) - v_promo_discount);
  v_tps := ROUND(v_subtotal * 0.05, 2);
  v_tvq := ROUND(v_subtotal * 0.09975, 2);
  v_total := ROUND(v_subtotal + v_tps + v_tvq, 2);

  -- Generate invoice number
  SELECT public.generate_billing_invoice_number() INTO v_invoice_number;

  -- Create invoice
  INSERT INTO public.billing_invoices (
    customer_id, invoice_number, type, subtotal, tps_amount, tvq_amount, total,
    currency, payment_method, status, cycle_start_date, cycle_end_date, due_date,
    order_id
  ) VALUES (
    v_customer_id, v_invoice_number, 'renewal', v_subtotal, v_tps, v_tvq, v_total,
    'CAD', 'interac', 'pending',
    v_new_cycle_start::text, v_new_cycle_end::text, v_due_date::text,
    v_sub.order_id
  ) RETURNING id INTO v_invoice_id;

  -- Create invoice line(s)
  INSERT INTO public.billing_invoice_lines (invoice_id, description, unit_price, quantity, line_total, line_type)
  VALUES (v_invoice_id, COALESCE(v_sub.plan_name, 'Abonnement') || ' – Renouvellement 30 jours',
    COALESCE(v_sub.monthly_price, v_sub.amount, 0), 1, COALESCE(v_sub.monthly_price, v_sub.amount, 0), 'service');

  IF v_promo_discount > 0 THEN
    INSERT INTO public.billing_invoice_lines (invoice_id, description, unit_price, quantity, line_total, line_type)
    VALUES (v_invoice_id, 'Rabais promotionnel', -v_promo_discount, 1, -v_promo_discount, 'discount');
  END IF;

  -- Update next_billing_date (+30 days)
  UPDATE public.subscriptions
  SET next_billing_date = v_sub.next_billing_date + INTERVAL '30 days',
      updated_at = now()
  WHERE id = p_subscription_id;

  -- Log to automation log
  INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
  VALUES (
    COALESCE(v_sub.order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'renewal_invoice_generated', 'billing_invoice', v_invoice_id,
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'invoice_number', v_invoice_number,
      'subtotal', v_subtotal,
      'total', v_total,
      'cycle_start', v_new_cycle_start,
      'cycle_end', v_new_cycle_end,
      'promo_discount', v_promo_discount
    )
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total', v_total,
    'next_billing_date', (v_sub.next_billing_date + INTERVAL '30 days')::text
  );
END;
$$;

-- 3. Batch renewal function: processes all due subscriptions
CREATE OR REPLACE FUNCTION public.fn_run_subscription_renewals(p_lookahead_days int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_result jsonb;
  v_results jsonb[] := ARRAY[]::jsonb[];
  v_processed int := 0;
  v_created int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_target_date date;
BEGIN
  v_target_date := CURRENT_DATE + (p_lookahead_days || ' days')::interval;

  FOR v_sub IN
    SELECT id, subscription_number, next_billing_date
    FROM public.subscriptions
    WHERE status = 'active'
      AND next_billing_date <= v_target_date
    ORDER BY next_billing_date ASC
  LOOP
    v_processed := v_processed + 1;
    BEGIN
      v_result := public.fn_generate_subscription_renewal(v_sub.id);
      IF (v_result ->> 'status') = 'created' THEN
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
      v_results := array_append(v_results, jsonb_build_object(
        'subscription_id', v_sub.id,
        'subscription_number', v_sub.subscription_number,
        'result', v_result
      ));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_results := array_append(v_results, jsonb_build_object(
        'subscription_id', v_sub.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'run_date', CURRENT_DATE,
    'target_date', v_target_date,
    'processed', v_processed,
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errors,
    'details', to_jsonb(v_results)
  );
END;
$$;
