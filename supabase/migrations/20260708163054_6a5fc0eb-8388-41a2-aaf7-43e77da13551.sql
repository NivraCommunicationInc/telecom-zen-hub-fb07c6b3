
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
  v_row JSONB;
  v_src TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  v_row := to_jsonb(NEW);
  v_src := lower(coalesce(v_row->>'source', v_row->>'payment_source', ''));
  IF lower(coalesce(v_ctx, '')) = 'paypal'
     OR v_src LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Account adjustments from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
  v_row JSONB;
  v_src TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  v_row := to_jsonb(NEW);
  v_src := lower(coalesce(v_row->>'source', v_row->>'promo_code', ''));
  IF lower(coalesce(v_ctx, '')) = 'paypal'
     OR v_src LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Account promotions from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
