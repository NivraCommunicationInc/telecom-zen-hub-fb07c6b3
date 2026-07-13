CREATE OR REPLACE FUNCTION public.fn_subscription_cycle_coherence_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anchor_day INT;
  v_end_day INT;
  v_cur_day INT;
BEGIN
  IF NEW.status <> 'active' OR NEW.cycle_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(a.billing_anchor_day, a.billing_cycle_day)
    INTO v_anchor_day
  FROM billing_customers bc
  JOIN accounts a ON a.client_id = bc.user_id
  WHERE bc.id = NEW.customer_id
  LIMIT 1;

  IF v_anchor_day IS NULL THEN
    RETURN NEW;
  END IF;

  v_end_day := EXTRACT(day FROM (NEW.cycle_end_date + INTERVAL '1 day'))::int;
  v_cur_day := EXTRACT(day FROM NEW.cycle_end_date)::int;

  -- Canonical convention: cycle_end_date = day BEFORE next anchor
  IF v_end_day = v_anchor_day THEN
    RETURN NEW;
  END IF;

  -- Legacy/inclusive convention (day == anchor): accept as-is (both are valid)
  IF v_cur_day = v_anchor_day THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'INVARIANT-SUBSCRIPTION-CYCLE-COHERENCE: cycle_end_date (%) incohérent avec billing_anchor_day (%) du compte.',
    NEW.cycle_end_date, v_anchor_day
    USING ERRCODE = 'check_violation';
END;
$function$;