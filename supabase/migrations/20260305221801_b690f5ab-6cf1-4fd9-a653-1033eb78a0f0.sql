
-- 1) Add pricing_snapshot to orders for structured server-side pricing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

-- 2) Add min_payable_cents to promotions (enforces minimum payable after discount)
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS min_payable_cents INTEGER DEFAULT NULL;

-- 3) Create the server-side pricing engine RPC
CREATE OR REPLACE FUNCTION public.compute_checkout_pricing(
  p_cart_items JSONB,         -- [{type, name, amount, quantity}]
  p_promo_code TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_preauth_discount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recurring_subtotal   INTEGER := 0;  -- cents
  v_one_time_subtotal    INTEGER := 0;  -- cents
  v_discount_total       INTEGER := 0;  -- cents
  v_taxable_base         INTEGER := 0;
  v_tps                  INTEGER := 0;
  v_tvq                  INTEGER := 0;
  v_grand_total          INTEGER := 0;
  v_item                 JSONB;
  v_promo                RECORD;
  v_eligible_cents       INTEGER := 0;
  v_min_payable          INTEGER := 0;
  v_promo_applied        JSONB := NULL;
  v_preauth_cents        INTEGER := 0;
BEGIN
  -- Parse cart items and split into recurring vs one-time (all math in cents)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    DECLARE
      item_type TEXT := v_item->>'type';
      item_amount_cents INTEGER := ROUND((v_item->>'amount')::NUMERIC * 100)::INTEGER;
      item_qty INTEGER := COALESCE((v_item->>'quantity')::INTEGER, 1);
    BEGIN
      IF item_type = 'service' THEN
        v_recurring_subtotal := v_recurring_subtotal + (item_amount_cents * item_qty);
      ELSE
        -- equipment, one_time_fee, delivery, installation, activation
        v_one_time_subtotal := v_one_time_subtotal + (item_amount_cents * item_qty);
      END IF;
    END;
  END LOOP;

  -- Apply promo if provided
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    SELECT * INTO v_promo
    FROM public.promotions
    WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_promo_code))
      AND status = 'active'
      AND (start_at IS NULL OR start_at <= NOW())
      AND (end_at IS NULL OR end_at >= NOW())
    LIMIT 1;

    IF v_promo.id IS NOT NULL THEN
      -- Compute eligible subtotal based on applies_to
      v_eligible_cents := 0;
      
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
      LOOP
        DECLARE
          it TEXT := v_item->>'type';
          ic INTEGER := ROUND((v_item->>'amount')::NUMERIC * 100)::INTEGER * COALESCE((v_item->>'quantity')::INTEGER, 1);
          applies JSONB := v_promo.applies_to;
        BEGIN
          IF (it = 'service' AND (applies->>'services')::BOOLEAN = TRUE)
            OR (it = 'one_time_fee' AND (applies->>'one_time_fees')::BOOLEAN = TRUE)
            OR (it = 'equipment' AND (applies->>'equipment')::BOOLEAN = TRUE)
            OR (it = 'delivery' AND (applies->>'delivery')::BOOLEAN = TRUE)
            OR (it = 'installation' AND (applies->>'installation')::BOOLEAN = TRUE)
            OR (it = 'activation' AND (applies->>'one_time_fees')::BOOLEAN = TRUE)
          THEN
            v_eligible_cents := v_eligible_cents + ic;
          END IF;
        END;
      END LOOP;

      -- Calculate raw discount
      IF v_promo.discount_type = 'percent' THEN
        v_discount_total := ROUND(v_eligible_cents * v_promo.discount_value / 100)::INTEGER;
      ELSIF v_promo.discount_type = 'fixed_amount' THEN
        v_discount_total := LEAST(ROUND(v_promo.discount_value * 100)::INTEGER, v_eligible_cents);
      END IF;

      -- Apply max_discount_amount cap
      IF v_promo.max_discount_amount IS NOT NULL THEN
        v_discount_total := LEAST(v_discount_total, ROUND(v_promo.max_discount_amount * 100)::INTEGER);
      END IF;

      -- Enforce min_payable_cents: discount cannot reduce total below minimum
      v_min_payable := COALESCE(v_promo.min_payable_cents, 0);
      IF v_min_payable > 0 THEN
        DECLARE
          v_pre_discount INTEGER := v_recurring_subtotal + v_one_time_subtotal;
          v_max_discount INTEGER := GREATEST(0, v_pre_discount - v_min_payable);
        BEGIN
          v_discount_total := LEAST(v_discount_total, v_max_discount);
        END;
      END IF;

      v_promo_applied := jsonb_build_object(
        'id', v_promo.id,
        'code', v_promo.code,
        'name', v_promo.name,
        'discount_type', v_promo.discount_type,
        'discount_value', v_promo.discount_value,
        'discount_cents', v_discount_total,
        'discount_amount', ROUND(v_discount_total::NUMERIC / 100, 2),
        'min_payable_cents', v_min_payable,
        'duration', v_promo.duration,
        'applies_to', v_promo.applies_to
      );
    END IF;
  END IF;

  -- Preauth discount (in dollars, convert to cents)
  v_preauth_cents := ROUND(p_preauth_discount * 100)::INTEGER;

  -- Taxable base = subtotals - discounts (never negative)
  v_taxable_base := GREATEST(0, v_recurring_subtotal + v_one_time_subtotal - v_discount_total - v_preauth_cents);

  -- QC taxes: TPS 5%, TVQ 9.975%
  v_tps := ROUND(v_taxable_base * 0.05)::INTEGER;
  v_tvq := ROUND(v_taxable_base * 0.09975)::INTEGER;

  -- Grand total
  v_grand_total := v_taxable_base + v_tps + v_tvq;

  RETURN jsonb_build_object(
    'recurring_subtotal', ROUND(v_recurring_subtotal::NUMERIC / 100, 2),
    'one_time_subtotal', ROUND(v_one_time_subtotal::NUMERIC / 100, 2),
    'discount_total', ROUND(v_discount_total::NUMERIC / 100, 2),
    'preauth_discount', ROUND(v_preauth_cents::NUMERIC / 100, 2),
    'taxable_base', ROUND(v_taxable_base::NUMERIC / 100, 2),
    'tps_amount', ROUND(v_tps::NUMERIC / 100, 2),
    'tvq_amount', ROUND(v_tvq::NUMERIC / 100, 2),
    'grand_total', ROUND(v_grand_total::NUMERIC / 100, 2),
    'promo_applied', v_promo_applied,
    'computed_at', NOW(),
    -- Also return cents for exact storage
    'cents', jsonb_build_object(
      'recurring_subtotal', v_recurring_subtotal,
      'one_time_subtotal', v_one_time_subtotal,
      'discount_total', v_discount_total,
      'taxable_base', v_taxable_base,
      'tps', v_tps,
      'tvq', v_tvq,
      'grand_total', v_grand_total
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.compute_checkout_pricing TO authenticated;

-- 4) Refresh schema cache
NOTIFY pgrst, 'reload schema';
