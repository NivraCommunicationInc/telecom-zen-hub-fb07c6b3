CREATE OR REPLACE FUNCTION public.apply_referral_discount(
  p_account_id uuid,
  p_invoice_amount numeric,
  p_invoice_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount NUMERIC := 0;
  v_sub RECORD;
  v_month_index INT;
BEGIN
  SELECT bs.*
    INTO v_sub
    FROM billing_subscriptions bs
    JOIN billing_customers bc ON bc.id = bs.customer_id
    JOIN accounts a           ON a.client_id = bc.user_id
   WHERE a.id = p_account_id
     AND bs.status = 'active'
     AND bs.referral_discount_active = true
     AND bs.referral_discount_months_remaining > 0
   ORDER BY bs.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_discount := LEAST(v_sub.referral_discount_amount, p_invoice_amount);
  v_month_index := 10 - v_sub.referral_discount_months_remaining + 1;

  UPDATE billing_subscriptions
     SET referral_discount_months_remaining = referral_discount_months_remaining - 1,
         referral_discount_active = (referral_discount_months_remaining - 1) > 0
   WHERE id = v_sub.id;

  -- Optional: insert a discount line on the invoice so compute_invoice_breakdown
  -- and all PDF/email renderers display it consistently.
  IF p_invoice_id IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO billing_invoice_lines (
      invoice_id, line_type, description, quantity, unit_price, line_total, metadata
    ) VALUES (
      p_invoice_id,
      'discount',
      'Rabais référence — mois ' || v_month_index::text || '/10',
      1,
      -v_discount,
      -v_discount,
      jsonb_build_object(
        'source', 'referral_program',
        'subscription_id', v_sub.id,
        'month_index', v_month_index,
        'total_months', 10
      )
    );
  END IF;

  INSERT INTO client_referral_events (referral_id, event_type, notes)
  SELECT cr.id, 'discount_applied',
         'Rabais référence ' || v_discount::text || '$ appliqué — mois ' ||
           v_month_index::text || '/10'
    FROM client_referrals cr
   WHERE cr.referred_account_id = p_account_id
     AND cr.status IS DISTINCT FROM 'disqualified'::referral_status
   LIMIT 1;

  RETURN v_discount;
END;
$function$;