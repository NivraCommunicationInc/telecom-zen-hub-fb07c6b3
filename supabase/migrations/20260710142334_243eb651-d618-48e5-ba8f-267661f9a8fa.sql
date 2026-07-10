DROP FUNCTION IF EXISTS public.validate_referral_code(TEXT);

CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE(is_valid BOOLEAN, code_id UUID, discount_amount NUMERIC, discount_months INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT TRUE, rc.id, rc.referred_discount_amount, rc.referred_discount_months
  FROM referral_codes rc
  WHERE rc.code = UPPER(p_code)
    AND rc.status = 'active'
    AND (rc.usage_limit_total IS NULL OR rc.usage_count < rc.usage_limit_total)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::NUMERIC, NULL::INTEGER;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon, authenticated, service_role;