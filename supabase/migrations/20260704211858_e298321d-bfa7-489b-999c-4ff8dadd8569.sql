CREATE OR REPLACE FUNCTION public.protect_billing_anchor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active boolean;
  v_override text;
BEGIN
  IF NEW.billing_cycle_day IS NOT DISTINCT FROM OLD.billing_cycle_day
     AND NEW.billing_anchor_day IS NOT DISTINCT FROM OLD.billing_anchor_day
     AND NEW.billing_anchor_date IS NOT DISTINCT FROM OLD.billing_anchor_date THEN
    RETURN NEW;
  END IF;

  IF OLD.billing_cycle_day IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_override := current_setting('nivra.allow_anchor_override', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := NULL;
  END;

  IF v_override = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.billing_subscriptions bs
    JOIN public.billing_customers bc ON bc.id = bs.customer_id
    WHERE bc.user_id = NEW.client_id
      AND bs.status::text IN ('active','pending','suspended')
  ) INTO v_has_active;

  IF v_has_active THEN
    RAISE EXCEPTION
      'billing_anchor is IMMUTABLE on accounts with active subscriptions (account=%). Use admin override.',
      NEW.id USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;