
-- 1) checkout_sessions table for persistence
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  kyc_session_id UUID,
  appointment_id UUID,
  cart_items JSONB DEFAULT '[]',
  pricing_snapshot JSONB,
  promo_code TEXT,
  service_address JSONB,
  identity_data JSONB,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkout sessions"
  ON public.checkout_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) commit_order_atomic RPC — single transaction for order + items + invoice + lines + links
CREATE OR REPLACE FUNCTION public.commit_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  v_user_id := (p_payload->>'user_id')::UUID;
  v_pricing := p_payload->'pricing_snapshot';

  -- Step 1: Insert order
  INSERT INTO public.orders (
    user_id,
    client_email,
    client_first_name,
    client_last_name,
    client_dob,
    client_phone,
    service_type,
    category,
    status,
    payment_method,
    payment_status,
    subtotal,
    discount_amount,
    tps_amount,
    tvq_amount,
    total_amount,
    pricing_snapshot,
    identity_verification_session_id,
    identity_snapshot,
    promo_code,
    promo_discount_amount,
    promo_details,
    shipping_address,
    shipping_city,
    shipping_province,
    shipping_postal_code,
    installation_type,
    delivery_fee,
    activation_fee,
    installation_fee,
    equipment_details,
    notes,
    created_by,
    client_request_id
  ) VALUES (
    v_user_id,
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

  -- Step 2: Create order_items from cart
  IF p_payload ? 'order_items' AND jsonb_array_length(p_payload->'order_items') > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'order_items')
    LOOP
      INSERT INTO public.order_items (
        order_id,
        service_type,
        service_name,
        plan_code,
        monthly_price,
        quantity,
        status
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
      user_id,
      email,
      first_name,
      last_name,
      phone
    ) VALUES (
      v_user_id,
      COALESCE(p_payload->>'client_email', ''),
      COALESCE(p_payload->>'client_first_name', ''),
      COALESCE(p_payload->>'client_last_name', ''),
      COALESCE(p_payload->>'client_phone', '')
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- Step 4: Create billing_invoice
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  
  INSERT INTO public.billing_invoices (
    customer_id,
    order_id,
    invoice_number,
    type,
    status,
    subtotal,
    tps_amount,
    tvq_amount,
    total,
    balance_due,
    due_date,
    cycle_start_date,
    cycle_end_date
  ) VALUES (
    v_customer_id,
    v_order_id,
    v_invoice_number,
    'initial',
    'unpaid',
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

  -- Step 5: Create billing_invoice_lines from cart items
  IF p_payload ? 'order_items' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'order_items')
    LOOP
      INSERT INTO public.billing_invoice_lines (
        invoice_id,
        description,
        unit_price,
        quantity,
        line_total,
        line_type
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

  -- Step 6: Add discount line if applicable
  IF COALESCE((v_pricing->>'discount_total')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (
      invoice_id,
      description,
      unit_price,
      quantity,
      line_total,
      line_type
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

  -- Step 7: Add tax lines
  IF COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total, line_type
    ) VALUES (
      v_invoice_id, 'TPS (5%)', COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0), 1, COALESCE((v_pricing->>'tps_amount')::NUMERIC, 0), 'tax'
    );
    v_lines_created := v_lines_created + 1;
  END IF;

  IF COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0) > 0 THEN
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total, line_type
    ) VALUES (
      v_invoice_id, 'TVQ (9.975%)', COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0), 1, COALESCE((v_pricing->>'tvq_amount')::NUMERIC, 0), 'tax'
    );
    v_lines_created := v_lines_created + 1;
  END IF;

  -- Step 8: Link appointment if provided
  IF p_payload->>'appointment_id' IS NOT NULL THEN
    UPDATE public.appointments 
    SET order_id = v_order_id, status = 'confirmed'
    WHERE id = (p_payload->>'appointment_id')::UUID;
  END IF;

  -- Step 9: Create contract record
  INSERT INTO public.contracts (
    order_id,
    user_id,
    status,
    version
  ) VALUES (
    v_order_id,
    v_user_id,
    'draft',
    1
  )
  RETURNING id INTO v_contract_id;

  -- Return all IDs + counts
  RETURN jsonb_build_object(
    'status', 'committed',
    'order_id', v_order_id,
    'order_number', v_order_number,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'contract_id', v_contract_id,
    'customer_id', v_customer_id,
    'items_created', v_items_created,
    'lines_created', v_lines_created,
    'pricing_snapshot', v_pricing
  );

EXCEPTION WHEN OTHERS THEN
  -- Transaction auto-rolls back
  RETURN jsonb_build_object(
    'status', 'error',
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.commit_order_atomic TO authenticated;

NOTIFY pgrst, 'reload schema';
