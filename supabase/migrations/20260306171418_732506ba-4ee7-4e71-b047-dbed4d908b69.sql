
CREATE OR REPLACE FUNCTION public.compute_checkout_pricing(
  p_cart_items jsonb,
  p_promo_code text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_client_id text DEFAULT NULL,
  p_preauth_discount numeric DEFAULT 0,
  p_is_new_customer boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_recurring_cents bigint := 0;
  v_one_time_cents bigint := 0;
  v_promo_discount_cents bigint := 0;
  v_welcome_discount_cents bigint := 0;
  v_preauth_discount_cents bigint := 0;
  v_discount_total_cents bigint := 0;
  v_taxable_base_cents bigint := 0;
  v_tps_cents bigint := 0;
  v_tvq_cents bigint := 0;
  v_grand_total_cents bigint := 0;
  v_one_time_tps_cents bigint := 0;
  v_one_time_tvq_cents bigint := 0;
  v_one_time_total_with_tax_cents bigint := 0;
  v_monthly_tps_cents bigint := 0;
  v_monthly_tvq_cents bigint := 0;
  v_monthly_total_with_tax_cents bigint := 0;
  v_promo_applied jsonb := NULL;
  v_item_type text;
  v_item_amount numeric;
  v_service_subtotal_cents bigint := 0;
  -- Promo lookup
  v_promo record;
  v_promo_discount_value numeric;
  v_promo_discount_amount numeric;
  v_min_payable_cents bigint := 0;
BEGIN
  -- Step 1: Classify and sum cart items (in cents to avoid floating-point)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_item_type := v_item->>'type';
    v_item_amount := COALESCE((v_item->>'amount')::numeric, 0);
    
    IF v_item_type = 'service' THEN
      v_recurring_cents := v_recurring_cents + ROUND(v_item_amount * 100)::bigint;
      v_service_subtotal_cents := v_service_subtotal_cents + ROUND(v_item_amount * 100)::bigint;
    ELSE
      -- equipment, one_time_fee, delivery, installation, activation
      v_one_time_cents := v_one_time_cents + ROUND(v_item_amount * 100)::bigint;
    END IF;
  END LOOP;

  -- Step 2: Welcome discount (50% on services only, first month)
  IF p_is_new_customer AND v_service_subtotal_cents > 0 THEN
    v_welcome_discount_cents := ROUND(v_service_subtotal_cents * 0.5);
  END IF;

  -- Step 3: Promo code lookup
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    SELECT * INTO v_promo
    FROM promotions
    WHERE UPPER(code) = UPPER(p_promo_code)
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_until IS NULL OR valid_until >= now())
    LIMIT 1;

    IF v_promo IS NOT NULL THEN
      -- Check for conflict with welcome discount on services
      IF p_is_new_customer AND v_welcome_discount_cents > 0 
         AND v_promo.applies_to IS NOT NULL 
         AND (v_promo.applies_to->>'services')::boolean = true THEN
        -- Welcome discount already covers services — reject promo to prevent stacking
        v_promo_applied := NULL;
      ELSE
        -- Calculate promo discount
        IF v_promo.discount_type = 'percentage' THEN
          v_promo_discount_value := COALESCE(v_promo.discount_value, 0);
          v_promo_discount_amount := (v_recurring_cents + v_one_time_cents) * v_promo_discount_value / 100.0;
          v_promo_discount_cents := ROUND(v_promo_discount_amount)::bigint;
        ELSIF v_promo.discount_type = 'fixed' THEN
          v_promo_discount_cents := ROUND(COALESCE(v_promo.discount_value, 0) * 100)::bigint;
        END IF;

        v_min_payable_cents := COALESCE((v_promo.min_payable_cents)::bigint, 0);

        v_promo_applied := jsonb_build_object(
          'id', v_promo.id,
          'code', v_promo.code,
          'name', v_promo.name,
          'discount_type', v_promo.discount_type,
          'discount_value', v_promo.discount_value,
          'discount_cents', v_promo_discount_cents,
          'discount_amount', ROUND(v_promo_discount_cents / 100.0, 2),
          'min_payable_cents', v_min_payable_cents,
          'duration', COALESCE(v_promo.duration, 'once'),
          'applies_to', COALESCE(v_promo.applies_to, '{}'::jsonb)
        );
      END IF;
    END IF;
  END IF;

  -- Step 4: Preauth discount (monthly)
  v_preauth_discount_cents := ROUND(COALESCE(p_preauth_discount, 0) * 100)::bigint;

  -- Step 5: Sum discounts (cap at total)
  v_discount_total_cents := v_promo_discount_cents + v_welcome_discount_cents + v_preauth_discount_cents;
  IF v_discount_total_cents > (v_recurring_cents + v_one_time_cents) THEN
    v_discount_total_cents := v_recurring_cents + v_one_time_cents;
  END IF;

  -- Enforce min_payable_cents if promo has it
  IF v_min_payable_cents > 0 AND (v_recurring_cents + v_one_time_cents - v_discount_total_cents) < v_min_payable_cents THEN
    v_discount_total_cents := GREATEST(0, (v_recurring_cents + v_one_time_cents) - v_min_payable_cents);
  END IF;

  -- Step 6: Calculate global taxable base and taxes
  v_taxable_base_cents := GREATEST(0, v_recurring_cents + v_one_time_cents - v_discount_total_cents);
  v_tps_cents := ROUND(v_taxable_base_cents * 0.05);
  v_tvq_cents := ROUND(v_taxable_base_cents * 0.09975);
  v_grand_total_cents := v_taxable_base_cents + v_tps_cents + v_tvq_cents;

  -- Step 7: Per-block breakdown — one-time
  v_one_time_tps_cents := ROUND(v_one_time_cents * 0.05);
  v_one_time_tvq_cents := ROUND(v_one_time_cents * 0.09975);
  v_one_time_total_with_tax_cents := v_one_time_cents + v_one_time_tps_cents + v_one_time_tvq_cents;

  -- Step 8: Per-block breakdown — monthly (recurring minus applicable discounts)
  DECLARE
    v_monthly_taxable_cents bigint;
  BEGIN
    v_monthly_taxable_cents := GREATEST(0, v_recurring_cents - v_welcome_discount_cents - v_preauth_discount_cents);
    v_monthly_tps_cents := ROUND(v_monthly_taxable_cents * 0.05);
    v_monthly_tvq_cents := ROUND(v_monthly_taxable_cents * 0.09975);
    v_monthly_total_with_tax_cents := v_monthly_taxable_cents + v_monthly_tps_cents + v_monthly_tvq_cents;
  END;

  -- Return everything
  RETURN jsonb_build_object(
    'recurring_subtotal', ROUND(v_recurring_cents / 100.0, 2),
    'one_time_subtotal', ROUND(v_one_time_cents / 100.0, 2),
    'discount_total', ROUND(v_discount_total_cents / 100.0, 2),
    'promo_discount', ROUND(v_promo_discount_cents / 100.0, 2),
    'welcome_discount', ROUND(v_welcome_discount_cents / 100.0, 2),
    'preauth_discount', ROUND(v_preauth_discount_cents / 100.0, 2),
    'taxable_base', ROUND(v_taxable_base_cents / 100.0, 2),
    'tps_amount', ROUND(v_tps_cents / 100.0, 2),
    'tvq_amount', ROUND(v_tvq_cents / 100.0, 2),
    'grand_total', ROUND(v_grand_total_cents / 100.0, 2),
    'one_time_tps', ROUND(v_one_time_tps_cents / 100.0, 2),
    'one_time_tvq', ROUND(v_one_time_tvq_cents / 100.0, 2),
    'one_time_total_with_tax', ROUND(v_one_time_total_with_tax_cents / 100.0, 2),
    'monthly_tps', ROUND(v_monthly_tps_cents / 100.0, 2),
    'monthly_tvq', ROUND(v_monthly_tvq_cents / 100.0, 2),
    'monthly_total_with_tax', ROUND(v_monthly_total_with_tax_cents / 100.0, 2),
    'promo_applied', v_promo_applied,
    'is_new_customer', p_is_new_customer,
    'computed_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'cents', jsonb_build_object(
      'recurring_subtotal', v_recurring_cents,
      'one_time_subtotal', v_one_time_cents,
      'discount_total', v_discount_total_cents,
      'promo_discount', v_promo_discount_cents,
      'welcome_discount', v_welcome_discount_cents,
      'taxable_base', v_taxable_base_cents,
      'tps', v_tps_cents,
      'tvq', v_tvq_cents,
      'grand_total', v_grand_total_cents,
      'one_time_tps', v_one_time_tps_cents,
      'one_time_tvq', v_one_time_tvq_cents,
      'one_time_total_with_tax', v_one_time_total_with_tax_cents,
      'monthly_tps', v_monthly_tps_cents,
      'monthly_tvq', v_monthly_tvq_cents,
      'monthly_total_with_tax', v_monthly_total_with_tax_cents
    )
  );
END;
$$;
