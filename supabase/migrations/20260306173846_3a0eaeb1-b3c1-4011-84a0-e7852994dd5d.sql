-- Canonicalize compute_checkout_pricing overloaded signatures
-- Root cause: uuid signature returned incomplete payload (missing one_time_tps/monthly_tps fields)
-- while text signature returned full payload. Frontend could hit uuid path and display 0.00 via null->0 coercion.
-- Fix: make uuid signature delegate to text signature so both return identical complete payload.

CREATE OR REPLACE FUNCTION public.compute_checkout_pricing(
  p_cart_items jsonb,
  p_promo_code text DEFAULT NULL::text,
  p_client_email text DEFAULT NULL::text,
  p_client_id uuid DEFAULT NULL::uuid,
  p_preauth_discount numeric DEFAULT 0,
  p_is_new_customer boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.compute_checkout_pricing(
    p_cart_items => p_cart_items,
    p_promo_code => p_promo_code,
    p_client_email => p_client_email,
    p_client_id => p_client_id::text,
    p_preauth_discount => p_preauth_discount,
    p_is_new_customer => p_is_new_customer
  );
END;
$$;