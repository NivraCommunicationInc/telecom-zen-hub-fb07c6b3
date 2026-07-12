
-- ============================================================================
-- Lot 1 — Moteur de rabais récurrents (promotions actives sur chaque facture)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_active_account_promotions_to_invoice(
  p_invoice_id uuid
)
RETURNS TABLE(promotion_id uuid, discount_applied numeric, months_left integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invoice public.billing_invoices%ROWTYPE;
  v_promo   public.account_promotions%ROWTYPE;
  v_line_exists boolean;
  v_new_subtotal numeric(10,2);
  v_discount_total numeric(10,2) := 0;
  v_gst_rate numeric(6,4);
  v_qst_rate numeric(6,4);
  v_new_gst numeric(10,2);
  v_new_qst numeric(10,2);
  v_new_total numeric(10,2);
BEGIN
  SELECT * INTO v_invoice
  FROM public.billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture % introuvable', p_invoice_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Skip terminal states — never mutate a paid/void/cancelled invoice.
  IF v_invoice.status IN ('paid','void','cancelled','refunded') THEN
    RETURN;
  END IF;

  v_gst_rate := COALESCE(v_invoice.tax_gst_rate, 0.05);
  v_qst_rate := COALESCE(v_invoice.tax_qst_rate, 0.09975);

  FOR v_promo IN
    SELECT ap.*
    FROM public.account_promotions ap
    WHERE ap.customer_id = v_invoice.customer_id
      AND ap.is_active = true
      AND ap.months_remaining > 0
      AND ap.promotion_type = 'monthly_discount'
      AND ap.amount > 0
      AND (ap.expires_at IS NULL OR ap.expires_at > now())
    FOR UPDATE
  LOOP
    -- Idempotence : if a discount line for this promotion already exists on this
    -- invoice, skip it and do NOT decrement months_remaining a second time.
    SELECT EXISTS (
      SELECT 1 FROM public.billing_invoice_lines
      WHERE invoice_id = p_invoice_id
        AND line_kind = 'promotion'
        AND (metadata->>'account_promotion_id') = v_promo.id::text
    ) INTO v_line_exists;

    IF v_line_exists THEN
      CONTINUE;
    END IF;

    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total,
      line_type, line_kind, source_ref, metadata
    ) VALUES (
      p_invoice_id,
      COALESCE(v_promo.label, 'Promotion') || COALESCE(' (' || v_promo.promo_code || ')', ''),
      -v_promo.amount, 1, -v_promo.amount,
      'discount', 'promotion', 'promotion_applied',
      jsonb_build_object(
        'account_promotion_id', v_promo.id,
        'promo_code', v_promo.promo_code,
        'promotion_type', v_promo.promotion_type,
        'months_remaining_before', v_promo.months_remaining,
        'applied_at', now()
      )
    );

    v_discount_total := v_discount_total + v_promo.amount;

    -- Decrement counter; deactivate when exhausted.
    UPDATE public.account_promotions
    SET months_remaining = v_promo.months_remaining - 1,
        is_active = CASE WHEN v_promo.months_remaining - 1 <= 0 THEN false ELSE is_active END,
        updated_at = now()
    WHERE id = v_promo.id;

    promotion_id := v_promo.id;
    discount_applied := v_promo.amount;
    months_left := v_promo.months_remaining - 1;
    RETURN NEXT;
  END LOOP;

  -- Recompute invoice totals if any discount was applied.
  IF v_discount_total > 0 THEN
    v_new_subtotal := GREATEST(v_invoice.subtotal - v_discount_total, 0);
    v_new_gst := ROUND(v_new_subtotal * v_gst_rate, 2);
    v_new_qst := ROUND(v_new_subtotal * v_qst_rate, 2);
    v_new_total := ROUND(v_new_subtotal + v_new_gst + v_new_qst, 2);

    UPDATE public.billing_invoices
    SET subtotal   = v_new_subtotal,
        tps_amount = v_new_gst,
        tvq_amount = v_new_qst,
        total      = v_new_total,
        tax_snapshot = COALESCE(tax_snapshot, '{}'::jsonb) || jsonb_build_object(
          'promotions_applied_total', v_discount_total,
          'promotions_applied_at', now(),
          'subtotal_before_promotions', v_invoice.subtotal
        ),
        updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_active_account_promotions_to_invoice(uuid) TO authenticated, service_role;

-- ============================================================================
-- Patch renew_subscription : hook la RPC promotions après création de la facture
-- ============================================================================

CREATE OR REPLACE FUNCTION public.renew_subscription(
  p_subscription_id uuid,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sub public.billing_subscriptions%ROWTYPE;
  v_invoice_id uuid; v_existing uuid;
  v_next_start date; v_next_end date;
  v_subtotal numeric(10,2);
  v_gst_rate numeric(6,4) := 0.0500;
  v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2);
  v_invoice_number text;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id USING ERRCODE='no_data_found'; END IF;
  IF v_sub.frozen_unit_price IS NULL OR v_sub.frozen_name IS NULL THEN
    RAISE EXCEPTION 'Abonnement % sans données figées (frozen_*)', p_subscription_id USING ERRCODE='check_violation';
  END IF;
  IF v_sub.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'Abonnement % non-renouvelable (statut=%)', p_subscription_id, v_sub.status USING ERRCODE='check_violation';
  END IF;

  v_next_start := COALESCE(v_sub.cycle_end_date, CURRENT_DATE);
  v_next_end   := v_next_start + INTERVAL '1 month';

  SELECT id INTO v_existing FROM public.billing_invoices
   WHERE subscription_id=v_sub.id AND type='renewal'
     AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
     AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_subtotal := v_sub.frozen_unit_price;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);
  v_invoice_number := 'INV-RNW-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);

  BEGIN
    INSERT INTO public.billing_invoices (
      customer_id, invoice_number, status, subscription_id, type,
      subtotal, tps_amount, tvq_amount, total,
      tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid,
      cycle_start_date, cycle_end_date, due_date, currency, payment_method
    ) VALUES (
      v_sub.customer_id, v_invoice_number, 'pending', v_sub.id, 'renewal',
      v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
      jsonb_build_object(
        'gst_rate', v_gst_rate, 'qst_rate', v_qst_rate,
        'gst_amount', v_gst, 'qst_amount', v_qst,
        'jurisdiction','QC','computed_at', now(),
        'source','renewal_frozen',
        'frozen_unit_price', v_sub.frozen_unit_price,
        'source_subscription_id', v_sub.id
      ),
      0, v_next_start, v_next_end, v_next_end, COALESCE(v_sub.frozen_currency,'CAD'), 'manual'
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_invoice_id FROM public.billing_invoices
     WHERE subscription_id=v_sub.id AND type='renewal'
       AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
       AND status NOT IN ('void','cancelled') LIMIT 1;
    RETURN v_invoice_id;
  END;

  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, source_order_item_id, metadata
  ) VALUES (
    v_invoice_id, v_sub.frozen_name || ' — Renouvellement',
    v_sub.frozen_unit_price, 1, v_sub.frozen_unit_price,
    'service', 'order_item', 'product_recurring', v_sub.source_order_item_id,
    jsonb_build_object(
      'source','renewal_frozen',
      'subscription_id', v_sub.id,
      'cycle_start_date', v_next_start,
      'cycle_end_date', v_next_end
    )
  );

  -- ── Promotions récurrentes (Lot 1) ──
  -- Applique toutes les account_promotions actives et décrémente months_remaining.
  PERFORM public.apply_active_account_promotions_to_invoice(v_invoice_id);

  -- Advance subscription cycle
  UPDATE public.billing_subscriptions
  SET cycle_start_date = v_next_start,
      cycle_end_date = v_next_end,
      status = 'active',
      updated_at = now()
  WHERE id = v_sub.id;

  RETURN v_invoice_id;
END;
$function$;

-- ============================================================================
-- Lot 2 — Calendrier realtime unifié
-- ============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_slot_rules;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_slot_overrides;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_blocked_dates;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
