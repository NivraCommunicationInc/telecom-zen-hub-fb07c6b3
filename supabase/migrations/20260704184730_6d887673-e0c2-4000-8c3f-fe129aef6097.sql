
-- 1. compute_prorata_for_service — BASE 30 JOURS FIXE
CREATE OR REPLACE FUNCTION public.compute_prorata_for_service(
  p_account_id uuid,
  p_service_address_id uuid,
  p_monthly_price_cents integer,
  p_activation_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anchor smallint;
  v_prev_anchor date;
  v_next_anchor date;
  v_days_in_cycle int := 30;
  v_days_remaining int;
  v_prorata_cents int;
  v_activation date := COALESCE(p_activation_date, current_date);
  v_year int; v_month int; v_day int;
BEGIN
  IF p_monthly_price_cents IS NULL OR p_monthly_price_cents < 0 THEN
    RAISE EXCEPTION 'monthly_price_cents must be >= 0';
  END IF;

  SELECT COALESCE(billing_cycle_day, billing_anchor_day,
    LEAST(GREATEST(EXTRACT(day FROM created_at)::int, 1), 28))
  INTO v_anchor FROM public.accounts WHERE id = p_account_id;

  IF v_anchor IS NULL THEN
    v_anchor := LEAST(GREATEST(EXTRACT(day FROM v_activation)::int, 1), 28);
  END IF;
  v_anchor := LEAST(GREATEST(v_anchor, 1), 28);

  v_year := EXTRACT(year FROM v_activation)::int;
  v_month := EXTRACT(month FROM v_activation)::int;
  v_day := EXTRACT(day FROM v_activation)::int;

  IF v_day >= v_anchor THEN
    v_prev_anchor := make_date(v_year, v_month, v_anchor);
    v_next_anchor := (v_prev_anchor + interval '1 month')::date;
  ELSE
    v_next_anchor := make_date(v_year, v_month, v_anchor);
    v_prev_anchor := (v_next_anchor - interval '1 month')::date;
  END IF;

  v_days_remaining := (v_next_anchor - v_activation);
  IF v_days_remaining <= 0 OR v_days_remaining >= 30 THEN
    v_days_remaining := 0; v_prorata_cents := 0;
  ELSE
    v_prorata_cents := ROUND((p_monthly_price_cents::numeric * v_days_remaining::numeric) / 30.0)::int;
  END IF;

  RETURN jsonb_build_object(
    'account_id', p_account_id, 'service_address_id', p_service_address_id,
    'activation_date', v_activation, 'anchor_day', v_anchor,
    'prev_anchor', v_prev_anchor, 'next_anchor', v_next_anchor,
    'days_in_cycle', v_days_in_cycle, 'days_remaining', v_days_remaining,
    'monthly_price_cents', p_monthly_price_cents,
    'prorata_cents', v_prorata_cents, 'is_zero', v_prorata_cents = 0
  );
END;
$function$;

-- 2. Trigger protecting billing anchor on accounts with active subscriptions
CREATE OR REPLACE FUNCTION public.protect_billing_anchor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has_active boolean; v_override text;
BEGIN
  IF NEW.billing_cycle_day IS NOT DISTINCT FROM OLD.billing_cycle_day
     AND NEW.billing_anchor_day IS NOT DISTINCT FROM OLD.billing_anchor_day
     AND NEW.billing_anchor_date IS NOT DISTINCT FROM OLD.billing_anchor_date THEN
    RETURN NEW;
  END IF;
  IF OLD.billing_cycle_day IS NULL THEN RETURN NEW; END IF;
  BEGIN v_override := current_setting('nivra.allow_anchor_override', true);
  EXCEPTION WHEN OTHERS THEN v_override := NULL; END;
  IF v_override = 'on' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.billing_subscriptions bs
    JOIN public.billing_customers bc ON bc.id = bs.customer_id
    WHERE bc.user_id = NEW.client_id
      AND bs.status IN ('active','pending','past_due','suspended')
  ) INTO v_has_active;

  IF v_has_active THEN
    RAISE EXCEPTION
      'billing_anchor is IMMUTABLE on accounts with active subscriptions (account=%). Use admin override.',
      NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_billing_anchor ON public.accounts;
CREATE TRIGGER trg_protect_billing_anchor
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_billing_anchor();

-- 3. REPAIR 3 corrupted accounts
DO $$
BEGIN
  PERFORM set_config('nivra.allow_anchor_override', 'on', true);

  UPDATE public.accounts
  SET billing_cycle_day = 25, billing_anchor_day = 25,
      billing_anchor_date = '2026-05-25', next_invoice_date = '2026-07-25'
  WHERE account_number = '200756';

  UPDATE public.accounts
  SET billing_cycle_day = 23, billing_anchor_day = 23, billing_anchor_date = '2026-05-23'
  WHERE account_number = '566235';

  UPDATE public.accounts
  SET billing_cycle_day = 15, billing_anchor_day = 15, billing_anchor_date = '2026-05-15'
  WHERE account_number = '279424';
END $$;

-- 4. Fix activation invoice for 200756: prorata 21/30 * 110 = 77.00
UPDATE public.billing_invoices
SET subtotal = 77.00, tps_amount = 3.85, tvq_amount = 7.68,
    total = 88.53, balance_due = 0, amount_paid = 88.53,
    cycle_end_date = '2026-07-25', due_date = '2026-07-25'
WHERE id = '5a3e99c8-9850-47be-86f8-9ed1920ea690';

-- Void the pending duplicate invoice
UPDATE public.billing_invoices
SET status = 'void', balance_due = 0
WHERE id = '7face87d-9650-4e85-90e3-803e233a0ee0';

-- Align new subscription cycle to the account anchor
UPDATE public.billing_subscriptions
SET cycle_start_date = '2026-07-04', cycle_end_date = '2026-07-25',
    billing_anchor_date = '2026-05-25', next_renewal_at = '2026-07-25'
WHERE id = 'd2031da5-6921-4759-a08f-a897731e888f';

-- Credit for the $37.94 overpayment
INSERT INTO public.account_adjustments(
  account_id, type, amount, description, status, applies_to, is_permanent,
  months_total, months_remaining, applied_count
)
SELECT id, 'credit', 37.94,
  'Correction prorata activation 04-07-2026 (facture 4553763 recalculée 21j/30 sur base 30 fixe). Trop-perçu suite au bug anchor overwrite.',
  'active', 'invoice', false, 1, 1, 0
FROM public.accounts WHERE account_number = '200756';
