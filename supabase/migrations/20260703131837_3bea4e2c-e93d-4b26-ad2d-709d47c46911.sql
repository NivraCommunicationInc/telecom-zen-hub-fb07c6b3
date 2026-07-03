CREATE OR REPLACE FUNCTION public.field_intent_lock_for_payment(p_intent_id uuid)
RETURNS TABLE(locked boolean, current_status text, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
  v_status  text;
  v_amount  numeric;
BEGIN
  UPDATE public.field_payment_intents fpi
     SET status = 'processing', updated_at = now()
   WHERE fpi.id = p_intent_id
     AND fpi.status = 'pending'
     AND (fpi.expires_at IS NULL OR fpi.expires_at > now());

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT fpi.status, fpi.amount
    INTO v_status, v_amount
    FROM public.field_payment_intents fpi
   WHERE fpi.id = p_intent_id;

  locked         := (v_updated = 1);
  current_status := v_status;
  amount         := v_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.field_intent_lock_for_payment(uuid) TO service_role;