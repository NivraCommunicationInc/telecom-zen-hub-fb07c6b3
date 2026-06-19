-- ============================================================
-- Welcome first-month-free — universal eligibility helper
-- ============================================================
-- A client is eligible for the 100% "premier mois gratuit" offer
-- when no prior order has ever been placed under their user_id OR
-- under their email address. This guarantees the rule is applied
-- uniformly across:
--   • Guest checkout / Client portal (compute_checkout_pricing)
--   • Core POS / OneView CS (compute_checkout_pricing)
--   • CRM outbound call (crm-create-sale edge fn)
--   • Field sales (field-sales-sync edge fn)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_eligible_for_welcome_first_month(
  p_user_id UUID DEFAULT NULL,
  p_email   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := NULLIF(LOWER(TRIM(COALESCE(p_email, ''))), '');
  v_has_prior BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL AND v_email IS NULL THEN
    -- No identity at all → treat as eligible (guest first-time).
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE (
        (p_user_id IS NOT NULL AND o.user_id = p_user_id)
        OR (v_email IS NOT NULL AND LOWER(o.client_email) = v_email)
      )
      AND o.status IN (
        'completed','installation_completed','activated','active',
        'submitted','confirmed','pending_payment','pending_admin_review'
      )
    LIMIT 1
  ) INTO v_has_prior;

  RETURN NOT v_has_prior;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_eligible_for_welcome_first_month(UUID, TEXT)
  TO anon, authenticated, service_role;

-- ============================================================
-- compute_checkout_pricing — extend welcome eligibility to also
-- check by email (covers guest checkout where client_id is NULL).
-- Same 100% off the recurring forfait, never on one-time fees.
-- ============================================================
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
  v_total_discounts      INTEGER := 0;
  v_eligible_total       INTEGER := 0;
BEGIN
  -- STEP 1 — split recurring vs one-time
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

  -- STEP 2 — welcome 100% first month free (services only)
  -- Eligibility now checked by user_id OR email so guest checkouts
  -- and CRM/field/POS sales all behave identically.
  IF v_recurring_subtotal > 0 AND (p_client_id IS NOT NULL OR NULLIF(TRIM(COALESCE(p_client_email,'')), '') IS NOT NULL) THEN
    v_is_new_customer := public.is_eligible_for_welcome_first_month(p_client_id, p_client_email);
    IF v_is_new_customer THEN
      v_welcome_discount := v_recurring_subtotal;
      v_welcome_applied  := TRUE;
    END IF;
  END IF;

  -- STEP 3 — promo code (not stackable with welcome)
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    IF v_welcome_applied THEN
      v_promo_applied := jsonb_build_object(
        'id', NULL,
        'code', p_promo_code,
        'name', p_promo_code,
        'discount_type', 'blocked',
        'discount_value', 0,
        'discount_cents', 0,
        'discount_amount', 0,
        'min_payable_cents', 0,
        'duration', 'one_time',
        'applies_to', jsonb_build_object('plan', false, 'equipment', false, 'fees', false),
        'blocked_reason', 'not_stackable_with_welcome'
      );
    ELSE
      SELECT * INTO v_promo
      FROM public.promotions
      WHERE UPPER(code) = UPPER(p_promo_code)
        AND is_active = TRUE
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
      LIMIT 1;

      IF FOUND THEN
        v_eligible_cents := v_recurring_subtotal;
        IF v_promo.discount_type = 'percent' THEN
          v_promo_discount := LEAST(v_eligible_cents, ROUND(v_eligible_cents * v_promo.discount_value / 100.0)::INTEGER);
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_promo_discount := LEAST(v_eligible_cents, ROUND(v_promo.discount_value * 100)::INTEGER);
        END IF;
        v_promo_applied := jsonb_build_object(
          'id', v_promo.id,
          'code', v_promo.code,
          'name', v_promo.name,
          'discount_type', v_promo.discount_type,
          'discount_value', v_promo.discount_value,
          'discount_cents', v_promo_discount,
          'discount_amount', v_promo_discount / 100.0,
          'min_payable_cents', 0,
          'duration', COALESCE(v_promo.duration, 'one_time'),
          'applies_to', jsonb_build_object('plan', true, 'equipment', false, 'fees', false)
        );
      END IF;
    END IF;
  END IF;

  -- STEP 4 — preauth (autopay) discount, applied to recurring
  v_preauth_cents := ROUND(COALESCE(p_preauth_discount, 0) * 100)::INTEGER;
  v_preauth_cents := GREATEST(0, LEAST(v_preauth_cents, v_recurring_subtotal - v_welcome_discount - v_promo_discount));

  -- STEP 5 — global discount cap (defence-in-depth)
  v_eligible_total  := v_recurring_subtotal;
  v_total_discounts := v_welcome_discount + v_promo_discount + v_preauth_cents;
  IF v_total_discounts > v_eligible_total THEN
    v_preauth_cents   := GREATEST(0, v_eligible_total - v_welcome_discount - v_promo_discount);
    v_total_discounts := v_welcome_discount + v_promo_discount + v_preauth_cents;
  END IF;

  -- STEP 6 — taxes on (recurring - discounts) + one-time
  v_taxable_base := GREATEST(0, v_recurring_subtotal - v_total_discounts) + v_one_time_subtotal;
  v_tps := ROUND(v_taxable_base * 0.05)::INTEGER;
  v_tvq := ROUND(v_taxable_base * 0.09975)::INTEGER;
  v_grand_total := v_taxable_base + v_tps + v_tvq;

  RETURN jsonb_build_object(
    'recurring_subtotal',       v_recurring_subtotal / 100.0,
    'one_time_subtotal',        v_one_time_subtotal / 100.0,
    'discount_total_combined',  (v_welcome_discount + v_promo_discount) / 100.0,
    'promo_discount',           v_promo_discount / 100.0,
    'welcome_discount',         v_welcome_discount / 100.0,
    'welcome_applied',          v_welcome_applied,
    'is_new_customer',          v_is_new_customer,
    'preauth_discount',         v_preauth_cents / 100.0,
    'taxable_base',             v_taxable_base / 100.0,
    'tps_amount',               v_tps / 100.0,
    'tvq_amount',               v_tvq / 100.0,
    'grand_total',              v_grand_total / 100.0,
    'promo_applied',            v_promo_applied,
    'computed_at',              now(),
    'cents', jsonb_build_object(
      'recurring_subtotal',      v_recurring_subtotal,
      'one_time_subtotal',       v_one_time_subtotal,
      'discount_total_combined', v_welcome_discount + v_promo_discount,
      'promo_discount',          v_promo_discount,
      'welcome_discount',        v_welcome_discount,
      'taxable_base',            v_taxable_base,
      'tps',                     v_tps,
      'tvq',                     v_tvq,
      'grand_total',             v_grand_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_checkout_pricing(JSONB, TEXT, TEXT, UUID, NUMERIC)
  TO anon, authenticated, service_role;