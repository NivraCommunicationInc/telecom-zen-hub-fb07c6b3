
-- ============================================================================
-- provision_services_for_order(p_order_id UUID)
-- Idempotent function: reads order.equipment_details.line_items,
-- creates/activates billing_subscription + billing_subscription_services.
-- Called automatically when invoice becomes paid.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_customer_id UUID;
  v_subscription_id UUID;
  v_line_items JSONB;
  v_item JSONB;
  v_services_created INT := 0;
  v_plan_name TEXT;
  v_plan_code TEXT;
  v_plan_price NUMERIC := 0;
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  -- Step 1: Lock the order row
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Step 2: Extract line_items from equipment_details
  v_line_items := v_order.equipment_details->'line_items';
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No line_items in equipment_details');
  END IF;

  -- Step 3: Find billing_customer
  SELECT id INTO v_customer_id
  FROM billing_customers
  WHERE user_id = v_order.user_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No billing_customer for user');
  END IF;

  -- Step 4: Determine plan from service line items
  v_plan_name := COALESCE(v_order.service_type, 'Service');
  v_plan_code := 'order-' || v_order.order_number;
  v_cycle_start := CURRENT_DATE;
  v_cycle_end := CURRENT_DATE + INTERVAL '30 days';

  -- Calculate monthly recurring total from service items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    IF (v_item->>'type') IN ('tv', 'internet', 'mobile', 'streaming', 'addon')
       AND (v_item->>'period') = 'monthly' THEN
      v_plan_price := v_plan_price + COALESCE((v_item->>'unit_price')::NUMERIC, 0)
                      * COALESCE((v_item->>'qty')::INT, 1);
    END IF;
  END LOOP;

  -- Step 5: Find or create subscription (idempotent)
  SELECT id INTO v_subscription_id
  FROM billing_subscriptions
  WHERE customer_id = v_customer_id
    AND plan_code = v_plan_code;

  IF v_subscription_id IS NULL THEN
    -- Check if there is a pending subscription for this customer we can reuse
    SELECT id INTO v_subscription_id
    FROM billing_subscriptions
    WHERE customer_id = v_customer_id
      AND status = 'pending'
      AND plan_name = v_plan_name
    LIMIT 1;

    IF v_subscription_id IS NOT NULL THEN
      UPDATE billing_subscriptions SET
        plan_code = v_plan_code,
        plan_price = v_plan_price,
        cycle_start_date = v_cycle_start,
        cycle_end_date = v_cycle_end,
        status = 'active',
        service_category = v_order.category,
        updated_at = NOW()
      WHERE id = v_subscription_id;
    ELSE
      INSERT INTO billing_subscriptions (
        customer_id, plan_code, plan_name, plan_price,
        cycle_start_date, cycle_end_date, status, service_category
      ) VALUES (
        v_customer_id, v_plan_code, v_plan_name, v_plan_price,
        v_cycle_start, v_cycle_end, 'active', v_order.category
      )
      RETURNING id INTO v_subscription_id;
    END IF;
  ELSE
    UPDATE billing_subscriptions SET
      status = 'active',
      plan_price = v_plan_price,
      updated_at = NOW()
    WHERE id = v_subscription_id;
  END IF;

  -- Step 6: Create service rows (idempotent per service_code)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    IF (v_item->>'type') IN ('tv', 'internet', 'mobile', 'streaming', 'addon', 'router', 'terminal') THEN
      INSERT INTO billing_subscription_services (
        subscription_id, service_name, service_code,
        service_type, unit_price, quantity, is_active
      ) VALUES (
        v_subscription_id,
        v_item->>'name',
        COALESCE(v_item->>'ref_id', (v_item->>'type') || '-' || md5(v_item->>'name')),
        CASE
          WHEN (v_item->>'period') = 'monthly' THEN 'recurring'
          ELSE 'one_time'
        END,
        COALESCE((v_item->>'unit_price')::NUMERIC, 0),
        COALESCE((v_item->>'qty')::INT, 1),
        true
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_services_created := v_services_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- Step 7: Mark order completed only if services were provisioned
  UPDATE orders SET
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_order_id
    AND status != 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'services_created', v_services_created,
    'plan_name', v_plan_name,
    'plan_price', v_plan_price
  );
END;
$$;

-- Unique index for idempotent service creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_sub_services_unique
ON billing_subscription_services (subscription_id, service_code)
WHERE is_active = true;

-- ============================================================================
-- Update apply_payment_to_invoice to call provisioning on paid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'etransfer',
  p_provider TEXT DEFAULT NULL,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_provider_order_id TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'admin',
  p_created_by_name TEXT DEFAULT NULL,
  p_created_by_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_new_amount_paid NUMERIC;
  v_new_balance_due NUMERIC;
  v_is_paid BOOLEAN;
  v_is_partial BOOLEAN;
  v_existing_payment_id UUID;
  v_new_status TEXT;
  v_result JSONB;
  v_provision_result JSONB;
BEGIN
  -- Step 1: Idempotency check
  IF p_provider_payment_id IS NOT NULL THEN
    SELECT id INTO v_existing_payment_id
    FROM billing_payments
    WHERE provider_payment_id = p_provider_payment_id
    LIMIT 1;

    IF v_existing_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'payment_id', v_existing_payment_id,
        'message', 'Payment already recorded (idempotent)'
      );
    END IF;
  END IF;

  -- Step 2: Lock and fetch the invoice
  SELECT * INTO v_invoice
  FROM billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice not found: ' || p_invoice_id::text
    );
  END IF;

  IF p_customer_id IS NULL THEN
    p_customer_id := v_invoice.customer_id;
  END IF;

  -- Step 3: Insert billing_payments
  INSERT INTO billing_payments (
    invoice_id, customer_id, amount, method, provider,
    provider_payment_id, reference, status, received_at,
    source, created_by_name, created_by_role
  ) VALUES (
    p_invoice_id, p_customer_id, p_amount,
    p_method::billing_payment_method, p_provider,
    p_provider_payment_id, p_provider_order_id,
    'confirmed'::billing_payment_status,
    NOW(), p_source, p_created_by_name, p_created_by_role
  )
  RETURNING id INTO v_payment_id;

  -- Step 4: Recalculate invoice from ALL confirmed payments
  SELECT COALESCE(SUM(amount), 0) INTO v_new_amount_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_new_balance_due := GREATEST(0, v_invoice.total - v_new_amount_paid);
  v_is_paid := (v_new_balance_due <= 0);
  v_is_partial := (NOT v_is_paid AND v_new_amount_paid > 0);

  IF v_is_paid THEN
    v_new_status := 'paid';
  ELSIF v_is_partial THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_invoice.status::text;
  END IF;

  UPDATE billing_invoices SET
    amount_paid = v_new_amount_paid,
    balance_due = v_new_balance_due,
    status = v_new_status::billing_invoice_status,
    paid_at = CASE WHEN v_is_paid THEN NOW() ELSE paid_at END,
    payment_method = p_method::billing_payment_method,
    billing_snapshot_payment = CASE WHEN v_is_paid THEN jsonb_build_object(
      'method', p_method,
      'paid_at', NOW()::text,
      'transaction_id', p_provider_payment_id,
      'amount', p_amount,
      'provider', p_provider
    ) ELSE billing_snapshot_payment END
  WHERE id = p_invoice_id;

  -- Step 5: Sync linked order payment_status
  IF v_invoice.order_id IS NOT NULL THEN
    IF v_is_paid THEN
      UPDATE orders SET payment_status = 'paid' WHERE id = v_invoice.order_id;
    ELSIF v_is_partial THEN
      UPDATE orders SET payment_status = 'partial' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

  -- Step 6: Activate subscription if fully paid
  IF v_is_paid AND v_invoice.subscription_id IS NOT NULL THEN
    UPDATE billing_subscriptions SET
      status = 'active'::billing_subscription_status,
      auto_billing_enabled = true
    WHERE id = v_invoice.subscription_id;
  END IF;

  -- Step 7: PROVISION SERVICES when invoice is fully paid and linked to order
  IF v_is_paid AND v_invoice.order_id IS NOT NULL THEN
    v_provision_result := provision_services_for_order(v_invoice.order_id);

    IF NOT COALESCE((v_provision_result->>'success')::BOOLEAN, false) THEN
      INSERT INTO billing_system_alerts (
        alert_type, entity_type, entity_id, details
      ) VALUES (
        'provisioning_failed', 'order', v_invoice.order_id::text,
        jsonb_build_object(
          'invoice_id', p_invoice_id,
          'error', v_provision_result->>'error'
        )
      );
      UPDATE orders SET status = 'provisioning_failed' WHERE id = v_invoice.order_id;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'amount_applied', p_amount,
    'new_amount_paid', v_new_amount_paid,
    'new_balance_due', v_new_balance_due,
    'invoice_status', v_new_status,
    'is_fully_paid', v_is_paid,
    'order_synced', (v_invoice.order_id IS NOT NULL),
    'subscription_activated', (v_is_paid AND v_invoice.subscription_id IS NOT NULL),
    'provisioning', v_provision_result
  );

  RETURN v_result;
END;
$$;
