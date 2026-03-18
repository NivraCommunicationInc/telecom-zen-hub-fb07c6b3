-- ============================================================================
-- FIX: Canonical tax base alignment
-- invoice_subtotal = taxable_base = amount on which taxes are computed
-- This ensures: subtotal × 5% = TPS, subtotal × 9.975% = TVQ, with zero ambiguity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_checkout_pricing(
  p_cart_items JSONB,
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
  v_recurring_subtotal   INTEGER := 0;
  v_one_time_subtotal    INTEGER := 0;
  v_promo_discount       INTEGER := 0;
  v_welcome_discount     INTEGER := 0;
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
  v_is_new_customer      BOOLEAN := FALSE;
  v_welcome_applied      BOOLEAN := FALSE;
BEGIN
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
        v_one_time_subtotal := v_one_time_subtotal + (item_amount_cents * item_qty);
      END IF;
    END;
  END LOOP;

  IF p_client_id IS NOT NULL AND v_recurring_subtotal > 0 THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE user_id = p_client_id
        AND status IN ('completed', 'installation_completed', 'activated', 'active')
      LIMIT 1
    ) INTO v_is_new_customer;
    IF v_is_new_customer THEN
      v_welcome_discount := ROUND(v_recurring_subtotal * 0.50)::INTEGER;
      v_welcome_applied := TRUE;
    END IF;
  END IF;

  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    IF v_welcome_applied THEN
      v_promo_applied := jsonb_build_object(
        'id', NULL, 'code', p_promo_code,
        'name', 'Non cumulable avec le rabais nouveau client',
        'discount_type', 'none', 'discount_value', 0,
        'discount_cents', 0, 'discount_amount', 0,
        'min_payable_cents', 0, 'duration', NULL, 'duration_months', NULL,
        'applies_to', '{}'::JSONB, 'blocked_reason', 'welcome_discount_active'
      );
    ELSE
      SELECT * INTO v_promo
      FROM public.promotions
      WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_promo_code))
        AND status = 'active'
        AND (start_at IS NULL OR start_at <= NOW())
        AND (end_at IS NULL OR end_at >= NOW())
      LIMIT 1;

      IF v_promo.id IS NOT NULL THEN
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

        IF v_promo.discount_type = 'percent' THEN
          v_promo_discount := ROUND(v_eligible_cents * v_promo.discount_value / 100)::INTEGER;
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_promo_discount := LEAST(ROUND(v_promo.discount_value * 100)::INTEGER, v_eligible_cents);
        END IF;

        IF v_promo.max_discount_amount IS NOT NULL THEN
          v_promo_discount := LEAST(v_promo_discount, ROUND(v_promo.max_discount_amount * 100)::INTEGER);
        END IF;

        v_min_payable := COALESCE(v_promo.min_payable_cents, 0);
        IF v_min_payable > 0 THEN
          DECLARE
            v_pre_discount INTEGER := v_recurring_subtotal + v_one_time_subtotal;
            v_max_discount INTEGER := GREATEST(0, v_pre_discount - v_min_payable);
          BEGIN
            v_promo_discount := LEAST(v_promo_discount, v_max_discount);
          END;
        END IF;

        v_promo_applied := jsonb_build_object(
          'id', v_promo.id, 'code', v_promo.code, 'name', v_promo.name,
          'discount_type', v_promo.discount_type, 'discount_value', v_promo.discount_value,
          'discount_cents', v_promo_discount,
          'discount_amount', ROUND(v_promo_discount::NUMERIC / 100, 2),
          'min_payable_cents', v_min_payable,
          'duration', v_promo.duration,
          'duration_months', v_promo.duration_months,
          'applies_to', v_promo.applies_to
        );
      END IF;
    END IF;
  END IF;

  v_preauth_cents := ROUND(p_preauth_discount * 100)::INTEGER;
  v_taxable_base := GREATEST(0,
    v_recurring_subtotal + v_one_time_subtotal - v_promo_discount - v_welcome_discount - v_preauth_cents
  );
  v_tps := ROUND(v_taxable_base * 0.05)::INTEGER;
  v_tvq := ROUND(v_taxable_base * 0.09975)::INTEGER;
  v_grand_total := v_taxable_base + v_tps + v_tvq;

  RETURN jsonb_build_object(
    'recurring_subtotal', ROUND(v_recurring_subtotal::NUMERIC / 100, 2),
    'one_time_subtotal', ROUND(v_one_time_subtotal::NUMERIC / 100, 2),
    -- CANONICAL: subtotal = taxable_base = post-discount amount = tax computation base
    'subtotal', ROUND(v_taxable_base::NUMERIC / 100, 2),
    'discount_total_combined', ROUND((v_promo_discount + v_welcome_discount)::NUMERIC / 100, 2),
    'promo_discount', ROUND(v_promo_discount::NUMERIC / 100, 2),
    'welcome_discount', ROUND(v_welcome_discount::NUMERIC / 100, 2),
    'welcome_applied', v_welcome_applied,
    'is_new_customer', v_is_new_customer,
    'preauth_discount', ROUND(v_preauth_cents::NUMERIC / 100, 2),
    'taxable_base', ROUND(v_taxable_base::NUMERIC / 100, 2),
    'tps_amount', ROUND(v_tps::NUMERIC / 100, 2),
    'tvq_amount', ROUND(v_tvq::NUMERIC / 100, 2),
    'grand_total', ROUND(v_grand_total::NUMERIC / 100, 2),
    'promo_applied', v_promo_applied,
    'computed_at', NOW(),
    'cents', jsonb_build_object(
      'recurring_subtotal', v_recurring_subtotal,
      'one_time_subtotal', v_one_time_subtotal,
      'subtotal', v_taxable_base,
      'discount_total_combined', v_promo_discount + v_welcome_discount,
      'promo_discount', v_promo_discount,
      'welcome_discount', v_welcome_discount,
      'taxable_base', v_taxable_base,
      'tps', v_tps,
      'tvq', v_tvq,
      'grand_total', v_grand_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_checkout_pricing TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_checkout_pricing TO anon;
NOTIFY pgrst, 'reload schema';