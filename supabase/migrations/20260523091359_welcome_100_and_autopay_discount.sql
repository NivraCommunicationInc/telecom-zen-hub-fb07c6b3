-- ==============================================================================
-- BILLING — Welcome offer 100% premier mois + Autopay 5$ + Discount cap
-- ==============================================================================
-- Commercial pivot (2026-05): the welcome offer moves from "50% off first
-- month" to "100% off — premier mois gratuit". Important nuance: it covers
-- ONLY the recurring forfait price, NOT one-time fees (activation, equipment,
-- delivery, installation).
--
-- Same migration also:
--   - Hard-caps every discount so it can never exceed the eligible base
--     (defends against fraud + rounding bugs).
--   - Documents that the existing p_preauth_discount parameter is how
--     autopay clients get their 5$ — the caller MUST pass 5.0 when
--     auto_billing_enabled=true. We can't auto-detect that here because the
--     checkout RPC runs before the subscription exists.
--
-- This is a hot-path function (called on every cart change). Existing
-- semantics preserved; only the welcome rate + cap logic change.
-- ==============================================================================

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
  v_total_discounts      INTEGER := 0;  -- NEW: aggregate cap
  v_eligible_total       INTEGER := 0;  -- NEW: max possible discount
BEGIN
  -- ──────────────────────────────────────────────────────────────────
  -- STEP 1 — Aggregate the cart into recurring vs one-time subtotals.
  -- Recurring = forfait service price (Internet, TV, Mobile).
  -- One-time = activation, equipment, delivery, installation.
  -- ──────────────────────────────────────────────────────────────────
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

  -- ──────────────────────────────────────────────────────────────────
  -- STEP 2 — Welcome offer: 100% off the recurring forfait for net-new
  -- customers. "Net-new" = no completed/active order in their history.
  -- The offer applies ONLY to the service price; one-time fees (activation,
  -- equipment) are charged normally.
  -- ──────────────────────────────────────────────────────────────────
  IF p_client_id IS NOT NULL AND v_recurring_subtotal > 0 THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE user_id = p_client_id
        AND status IN ('completed', 'installation_completed', 'activated', 'active')
      LIMIT 1
    ) INTO v_is_new_customer;

    IF v_is_new_customer THEN
      -- CHANGED (was 0.50): now full forfait gratuit for the first month.
      v_welcome_discount := v_recurring_subtotal;
      v_welcome_applied := TRUE;
    END IF;
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- STEP 3 — Promo code (if any). Welcome and promo are not stackable.
  -- ──────────────────────────────────────────────────────────────────
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    IF v_welcome_applied THEN
      v_promo_applied := jsonb_build_object(
        'id', NULL,
        'code', p_promo_code,
        'name', 'Non cumulable avec le rabais nouveau client',
        'discount_type', 'none',
        'discount_value', 0,
        'discount_cents', 0,
        'discount_amount', 0,
        'min_payable_cents', 0,
        'duration', NULL,
        'applies_to', '{}'::JSONB,
        'blocked_reason', 'welcome_discount_active'
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
          'id', v_promo.id,
          'code', v_promo.code,
          'name', v_promo.name,
          'discount_type', v_promo.discount_type,
          'discount_value', v_promo.discount_value,
          'discount_cents', v_promo_discount,
          'discount_amount', ROUND(v_promo_discount::NUMERIC / 100, 2),
          'min_payable_cents', v_min_payable,
          'duration', v_promo.duration,
          'applies_to', v_promo.applies_to
        );
      END IF;
    END IF;
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- STEP 4 — Autopay discount (5$/month standard; caller passes the value).
  -- Convert dollars → cents for downstream math.
  -- ──────────────────────────────────────────────────────────────────
  v_preauth_cents := ROUND(p_preauth_discount * 100)::INTEGER;

  -- ──────────────────────────────────────────────────────────────────
  -- STEP 5 — HARD CAP — discounts cannot exceed eligible base.
  -- Eligible base for combined discounts = recurring + one-time.
  -- This is a defense-in-depth: prevents any single bug or upstream
  -- caller from sending a discount > subtotal which would produce a
  -- negative taxable base (which would have generated a credit invoice).
  -- ──────────────────────────────────────────────────────────────────
  v_eligible_total := v_recurring_subtotal + v_one_time_subtotal;
  v_total_discounts := v_promo_discount + v_welcome_discount + v_preauth_cents;
  IF v_total_discounts > v_eligible_total THEN
    -- Trim discounts proportionally, welcome first, promo second, preauth last.
    IF v_welcome_discount > v_eligible_total THEN
      v_welcome_discount := v_eligible_total;
      v_promo_discount := 0;
      v_preauth_cents := 0;
    ELSIF (v_welcome_discount + v_promo_discount) > v_eligible_total THEN
      v_promo_discount := GREATEST(0, v_eligible_total - v_welcome_discount);
      v_preauth_cents := 0;
    ELSE
      v_preauth_cents := GREATEST(0, v_eligible_total - v_welcome_discount - v_promo_discount);
    END IF;
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- STEP 6 — Taxes applied to (subtotal - discounts). Always >= 0.
  -- ──────────────────────────────────────────────────────────────────
  v_taxable_base := GREATEST(0,
    v_recurring_subtotal + v_one_time_subtotal
    - v_promo_discount
    - v_welcome_discount
    - v_preauth_cents
  );
  v_tps := ROUND(v_taxable_base * 0.05)::INTEGER;
  v_tvq := ROUND(v_taxable_base * 0.09975)::INTEGER;
  v_grand_total := v_taxable_base + v_tps + v_tvq;

  RETURN jsonb_build_object(
    'recurring_subtotal', ROUND(v_recurring_subtotal::NUMERIC / 100, 2),
    'one_time_subtotal', ROUND(v_one_time_subtotal::NUMERIC / 100, 2),
    'discount_total_combined', ROUND((v_promo_discount + v_welcome_discount + v_preauth_cents)::NUMERIC / 100, 2),
    'promo_discount', ROUND(v_promo_discount::NUMERIC / 100, 2),
    'welcome_discount', ROUND(v_welcome_discount::NUMERIC / 100, 2),
    'welcome_applied', v_welcome_applied,
    'welcome_percent', CASE WHEN v_welcome_applied THEN 100 ELSE 0 END,
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
      'discount_total_combined', v_promo_discount + v_welcome_discount + v_preauth_cents,
      'promo_discount', v_promo_discount,
      'welcome_discount', v_welcome_discount,
      'preauth_discount', v_preauth_cents,
      'taxable_base', v_taxable_base,
      'tps', v_tps,
      'tvq', v_tvq,
      'grand_total', v_grand_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_checkout_pricing TO authenticated;

-- Audit
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'BILLING_WELCOME_100_AUTOPAY_5',
  'info',
  jsonb_build_object(
    'description', 'Welcome offer raised to 100% of recurring forfait; discount cap enforced; autopay 5$ docs',
    'applied_at', now(),
    'changes', ARRAY[
      'Welcome discount: 50% → 100% of recurring subtotal (forfait only)',
      'Hard cap on combined discounts (welcome + promo + preauth) ≤ eligible base',
      'Discount cap applied BEFORE taxes (compliance: TPS+TVQ on net amount)',
      'preauth_discount kept in response payload for client display'
    ]
  )
);
