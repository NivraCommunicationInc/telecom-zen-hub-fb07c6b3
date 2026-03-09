
-- ============================================================
-- FIX 1: Auto-correct account_number format on INSERT/UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_enforce_account_number_format()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_number IS NULL 
     OR NEW.account_number = '' 
     OR NEW.account_number !~ '^[2-9][0-9]{5}$' THEN
    NEW.account_number := generate_secure_account_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_account_number_format ON accounts;
CREATE TRIGGER trg_enforce_account_number_format
  BEFORE INSERT OR UPDATE OF account_number ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_account_number_format();

-- ============================================================
-- FIX 2: Update commit_order_atomic to resolve/create account
-- and fix invoice_number format (was INV-xxx, now 7-digit)
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_order_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_user_id UUID;
  v_items_created INT := 0;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_lines_created INT := 0;
  v_customer_id UUID;
  v_pricing JSONB;
  v_item JSONB;
  v_contract_id UUID;
  v_account_id UUID;
BEGIN
  v_user_id := (p_payload->>'user_id')::UUID;
  v_pricing := p_payload->'pricing_snapshot';

  -- Step 0: Resolve or create account for this user
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE client_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (
      client_id,
      account_number,
      status,
      primary_service_address,
      primary_service_city,
      primary_service_postal_code,
      primary_service_province
    ) VALUES (
      v_user_id,
      generate_secure_account_number(),
      'active',
      COALESCE(p_payload->>'shipping_address', ''),
      COALESCE(p_payload->>'shipping_city', ''),
      COALESCE(p_payload->>'shipping_postal_code', ''),
      COALESCE(p_payload->>'shipping_province', 'QC')
    )
    RETURNING id INTO v_account_id;
  END IF;

  -- Step 1: Insert order with account_id
  INSERT INTO public.orders (
    user_id,
    account_id,
    client_email, client_first_name, client_last_name, client_dob, client_phone,
    service_type, category, status, payment_method, payment_status,
    subtotal, discount_amount, tps_amount, tvq_amount, total_amount,
    pricing_snapshot, identity_verification_session_id, identity_snapshot,
    promo_code, promo_discount_amount, promo_details,
    shipping_address, shipping_city, shipping_province, shipping_postal_code,
    installation_type, delivery_fee, activation_fee, installation_fee,
    equipment_details, notes, created_by, client_request_id
  ) VALUES (
    v_user_id,
    v_account_id,
    p_payload->>'client_email',
    p_payload->>'client_first_name',
    p_payload->>'client_last_name',
    p_payload->>'client_dob',
    p_payload->>'client_phone',
    p_payload->>'service_type',
    p_payload->>'category',
    COALESCE(p_payload->>'status', 'pending_verification'),
    p_payload->>'payment_method',
    COALESCE(p_payload->>'payment_status', 'pre_authorized'),
    COALESCE((v_pricing->>'recurring_subtotal')::NUMERIC, 0) + COALESCE((v_pricing->>'one_time_subtotal')::NUMERIC, 0),
    COALESCE((v_pricing->>'discount_total')::NUMERIC, 0),
    COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0),
    COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0),
    COALESCE((v_pricing->>'grand_total')::NUMERIC, 0),
    v_pricing,
    (p_payload->>'kyc_session_id')::UUID,
    p_payload->'identity_snapshot',
    p_payload->>'promo_code',
    COALESCE((v_pricing->>'discount_total')::NUMERIC, 0),
    v_pricing->'promo_applied',
    p_payload->>'shipping_address',
    p_payload->>'shipping_city',
    p_payload->>'shipping_province',
    p_payload->>'shipping_postal_code',
    p_payload->>'installation_type',
    COALESCE((p_payload->>'delivery_fee')::NUMERIC, 0),
    COALESCE((p_payload->>'activation_fee')::NUMERIC, 0),
    COALESCE((p_payload->>'installation_fee')::NUMERIC, 0),
    p_payload->'equipment_details',
    p_payload->>'notes',
    COALESCE(p_payload->>'created_by', 'client'),
    COALESCE(p_payload->>'client_request_id', gen_random_uuid()::TEXT)
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Step 2: Create order_items
  IF p_payload ? 'order_items' AND jsonb_array_length(p_payload->'order_items') > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'order_items')
    LOOP
      INSERT INTO public.order_items (
        order_id, service_type, service_name, plan_code, monthly_price, quantity, status
      ) VALUES (
        v_order_id,
        COALESCE(v_item->>'service_type', 'other'),
        COALESCE(v_item->>'service_name', v_item->>'name'),
        v_item->>'plan_code',
        COALESCE((v_item->>'monthly_price')::NUMERIC, (v_item->>'amount')::NUMERIC, 0),
        COALESCE((v_item->>'quantity')::INT, 1),
        'pending'
      );
      v_items_created := v_items_created + 1;
    END LOOP;
  END IF;

  -- Step 3: Find or create billing_customer
  SELECT id INTO v_customer_id
  FROM public.billing_customers
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.billing_customers (
      user_id, email, first_name, last_name, phone
    ) VALUES (
      v_user_id,
      COALESCE(p_payload->>'client_email', ''),
      COALESCE(p_payload->>'client_first_name', ''),
      COALESCE(p_payload->>'client_last_name', ''),
      COALESCE(p_payload->>'client_phone', '')
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- Step 4: Create billing_invoice (numeric-only invoice_number)
  v_invoice_number := generate_secure_numeric_id(7);

  INSERT INTO public.billing_invoices (
    customer_id, order_id, invoice_number, type, status,
    subtotal, tps_amount, tvq_amount, total, balance_due,
    due_date, cycle_start_date, cycle_end_date
  ) VALUES (
    v_customer_id, v_order_id, v_invoice_number, 'initial', 'unpaid',
    COALESCE((v_pricing->>'taxable_base')::NUMERIC, 0),
    COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0),
    COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0),
    COALESCE((v_pricing->>'grand_total')::NUMERIC, 0),
    COALESCE((v_pricing->>'grand_total')::NUMERIC, 0),
    (NOW() + INTERVAL '15 days')::DATE,
    NOW()::DATE,
    (NOW() + INTERVAL '30 days')::DATE
  )
  RETURNING id INTO v_invoice_id;

  -- Step 5: Invoice lines
  IF p_payload ? 'order_items' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'order_items')
    LOOP
      INSERT INTO public.billing_invoice_lines (
        invoice_id, description, unit_price, quantity, line_total, line_type
      ) VALUES (
        v_invoice_id,
        COALESCE(v_item->>'service_name', v_item->>'name', 'Service'),
        COALESCE((v_item->>'monthly_price')::NUMERIC, (v_item->>'amount')::NUMERIC, 0),
        COALESCE((v_item->>'quantity')::INT, 1),
        COALESCE((v_item->>'monthly_price')::NUMERIC, (v_item->>'amount')::NUMERIC, 0) * COALESCE((v_item->>'quantity')::INT, 1),
        COALESCE(v_item->>'line_type', 'service')
      );
      v_lines_created := v_lines_created + 1;
    END LOOP;
  END IF;

  -- Step 6: Discount line
  IF COALESCE((v_pricing->>'discount_total')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total, line_type
    ) VALUES (
      v_invoice_id,
      'Rabais promotionnel' || COALESCE(' (' || (v_pricing->'promo_applied'->>'code') || ')', ''),
      -1 * COALESCE((v_pricing->>'discount_total')::NUMERIC, 0),
      1,
      -1 * COALESCE((v_pricing->>'discount_total')::NUMERIC, 0),
      'discount'
    );
    v_lines_created := v_lines_created + 1;
  END IF;

  -- Step 7: Tax lines
  IF COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (invoice_id, description, unit_price, quantity, line_total, line_type)
    VALUES (v_invoice_id, 'TPS (5%)', COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0), 1, COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0), 'tax');
    v_lines_created := v_lines_created + 1;
  END IF;
  IF COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (invoice_id, description, unit_price, quantity, line_total, line_type)
    VALUES (v_invoice_id, 'TVQ (9.975%)', COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0), 1, COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0), 'tax');
    v_lines_created := v_lines_created + 1;
  END IF;

  -- Step 8: Link appointment
  IF p_payload->>'appointment_id' IS NOT NULL THEN
    UPDATE public.appointments SET order_id = v_order_id, status = 'confirmed'
    WHERE id = (p_payload->>'appointment_id')::UUID;
  END IF;

  -- Step 9: Contract
  INSERT INTO public.contracts (order_id, user_id, status, version)
  VALUES (v_order_id, v_user_id, 'draft', 1)
  RETURNING id INTO v_contract_id;

  RETURN jsonb_build_object(
    'status', 'committed',
    'order_id', v_order_id,
    'order_number', v_order_number,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'contract_id', v_contract_id,
    'customer_id', v_customer_id,
    'account_id', v_account_id,
    'items_created', v_items_created,
    'lines_created', v_lines_created,
    'pricing_snapshot', v_pricing
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;
