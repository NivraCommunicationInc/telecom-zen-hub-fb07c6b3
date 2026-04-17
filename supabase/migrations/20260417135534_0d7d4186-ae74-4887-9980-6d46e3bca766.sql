
CREATE OR REPLACE FUNCTION public.fn_check_order_completeness(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_missing text[] := ARRAY[]::text[];
  v_invoice_line_count int := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF COALESCE(v_order.client_first_name, '') = '' THEN v_missing := array_append(v_missing, 'client_first_name'); END IF;
  IF COALESCE(v_order.client_last_name, '') = ''  THEN v_missing := array_append(v_missing, 'client_last_name');  END IF;
  IF COALESCE(v_order.client_email, '') = ''      THEN v_missing := array_append(v_missing, 'client_email');      END IF;
  IF COALESCE(v_order.client_phone, '') = ''      THEN v_missing := array_append(v_missing, 'client_phone');      END IF;
  IF v_order.client_dob IS NULL                   THEN v_missing := array_append(v_missing, 'client_dob');        END IF;
  IF COALESCE(v_order.shipping_address, '') = ''  AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_address');  END IF;
  IF COALESCE(v_order.shipping_city, '') = ''     AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_city');     END IF;
  IF COALESCE(v_order.shipping_postal_code, '') = '' AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_postal_code'); END IF;

  -- Equipment / line items (stored as jsonb on equipment_line_details or equipment_details)
  IF v_order.equipment_line_details IS NULL
     AND (v_order.equipment_details IS NULL OR v_order.equipment_details = '{}'::jsonb) THEN
    v_missing := array_append(v_missing, 'equipment_or_line_items');
  END IF;

  -- Invoice lines
  SELECT COUNT(*) INTO v_invoice_line_count
  FROM public.billing_invoice_lines bil
  JOIN public.billing_invoices bi ON bi.id = bil.invoice_id
  WHERE bi.order_id = p_order_id;

  IF v_invoice_line_count = 0 THEN
    v_missing := array_append(v_missing, 'billing_invoice_lines');
  END IF;

  -- Promo amount mismatch (promo_code present but no discount recorded)
  IF v_order.promo_code IS NOT NULL
     AND COALESCE(v_order.promo_discount_amount, 0) = 0 THEN
    v_missing := array_append(v_missing, 'promo_discount_amount');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'order_id', p_order_id,
    'missing', to_jsonb(v_missing),
    'is_complete', array_length(v_missing, 1) IS NULL
  );
END;
$$;
