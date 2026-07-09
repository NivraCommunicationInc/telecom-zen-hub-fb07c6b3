-- Fix: fn_forbid_refund_as_promotion referenced NEW.description on account_promotions,
-- which has no such column (uses label/notes). Root cause of
-- "record NEW has no field description" when applying a promotion via Client 360.
CREATE OR REPLACE FUNCTION public.fn_forbid_refund_as_promotion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_text text;
BEGIN
  v_text := lower(
    COALESCE(NEW.label, '') || ' ' ||
    COALESCE(NEW.notes, '') || ' ' ||
    COALESCE(NEW.promo_code, '') || ' ' ||
    COALESCE(NEW.promotion_type, '')
  );
  IF v_text LIKE '%refund%'
     OR v_text LIKE '%remboursement%'
     OR v_text LIKE '%chargeback%' THEN
    RAISE EXCEPTION
      'INVARIANT-3B1: un remboursement ne peut pas être une promotion — utiliser refund_payment()'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$function$;