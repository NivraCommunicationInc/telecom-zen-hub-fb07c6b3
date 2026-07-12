
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
  SELECT * INTO v_invoice FROM public.billing_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture % introuvable', p_invoice_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_invoice.status IN ('paid','void','cancelled','refunded') THEN
    RETURN;
  END IF;

  v_gst_rate := COALESCE(v_invoice.tax_gst_rate, 0.05);
  v_qst_rate := COALESCE(v_invoice.tax_qst_rate, 0.09975);

  FOR v_promo IN
    SELECT ap.* FROM public.account_promotions ap
    WHERE ap.customer_id = v_invoice.customer_id
      AND ap.is_active = true
      AND ap.months_remaining > 0
      AND ap.promotion_type = 'monthly_discount'
      AND ap.amount > 0
      AND (ap.expires_at IS NULL OR ap.expires_at > now())
    FOR UPDATE
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.billing_invoice_lines
      WHERE invoice_id = p_invoice_id
        AND line_kind = 'promotion'
        AND (metadata->>'account_promotion_id') = v_promo.id::text
    ) INTO v_line_exists;

    IF v_line_exists THEN CONTINUE; END IF;

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
        )
    WHERE id = p_invoice_id;
  END IF;

  RETURN;
END;
$$;
