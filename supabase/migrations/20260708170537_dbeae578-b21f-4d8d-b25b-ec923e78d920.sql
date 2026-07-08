-- ============================================================
-- Loyalty program rebalance: fixed-points model
-- - Payment: 100 fixed (+25 autopay, +25 on-time)
-- - Service activation: 100 per service instance
-- - Referral qualified: 300
-- - Anniversary: 100 per year (function only, no cron wiring here)
-- - Rewards catalog rewritten (5$/750, 10$/1500, 25$/3500,
--   -5$/mo x3 mois/4000, 1 mois gratuit/8000)
-- Existing point balances are preserved.
-- ============================================================

-- 1) Payment trigger: fixed points + bonuses (no per-dollar math)
CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_points_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points INTEGER := 0;
  v_desc   TEXT := 'Paiement de facture';
  v_account_id UUID;
  v_client_id UUID;
  v_new_balance INTEGER;
  v_due_date TIMESTAMPTZ;
  v_is_autopay BOOLEAN := false;
  v_on_time BOOLEAN := false;
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN

    SELECT o.account_id, a.client_id, bi.due_date
      INTO v_account_id, v_client_id, v_due_date
    FROM public.billing_invoices bi
    LEFT JOIN public.orders o    ON o.id = bi.order_id
    LEFT JOIN public.accounts a  ON a.id = o.account_id
    WHERE bi.id = NEW.invoice_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Fixed base
    v_points := 100;

    -- AutoPay bonus (+25)
    v_is_autopay :=
      COALESCE(NEW.source,'')      ILIKE '%autopay%'
      OR COALESCE(NEW.payment_kind,'') ILIKE '%autopay%'
      OR COALESCE(NEW.reference,'') ILIKE '%autopay%'
      OR COALESCE(NEW.rpc_used,'')  ILIKE '%autopay%';
    IF v_is_autopay THEN
      v_points := v_points + 25;
      v_desc := v_desc || ' + AutoPay';
    END IF;

    -- On-time bonus (+25)
    IF v_due_date IS NOT NULL
       AND COALESCE(NEW.received_at, NEW.created_at, now()) <= v_due_date THEN
      v_points := v_points + 25;
      v_on_time := true;
      v_desc := v_desc || ' + à temps';
    END IF;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (v_account_id, v_client_id, v_points, v_points, v_points)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points     = public.loyalty_points.total_points     + EXCLUDED.total_points,
          available_points = public.loyalty_points.available_points + EXCLUDED.available_points,
          lifetime_points  = public.loyalty_points.lifetime_points  + EXCLUDED.lifetime_points,
          tier = CASE
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'platinum'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 1500 THEN 'gold'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >=  500 THEN 'silver'
            ELSE 'bronze'
          END,
          tier_updated_at = now(),
          updated_at      = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions
      (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES
      (v_account_id, 'earned_payment', v_points, v_desc,
       NEW.id, 'billing_payment', v_new_balance, now() + INTERVAL '2 years');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Service activation: +100 per service instance (once)
CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_on_service_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id UUID;
  v_new_balance INTEGER;
  v_already INT;
BEGIN
  IF NEW.status IN ('active','provisioned')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status::text,'') NOT IN ('active','provisioned'))
     AND NEW.account_id IS NOT NULL THEN

    -- Idempotency: skip if we already awarded for this service_instance
    SELECT count(*) INTO v_already
    FROM public.loyalty_transactions
    WHERE reference_type = 'service_instance'
      AND reference_id   = NEW.id
      AND type = 'earned_activation';
    IF v_already > 0 THEN
      RETURN NEW;
    END IF;

    SELECT client_id INTO v_client_id FROM public.accounts WHERE id = NEW.account_id;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (NEW.account_id, v_client_id, 100, 100, 100)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points     = public.loyalty_points.total_points     + 100,
          available_points = public.loyalty_points.available_points + 100,
          lifetime_points  = public.loyalty_points.lifetime_points  + 100,
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions
      (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES
      (NEW.account_id, 'earned_activation', 100,
       'Activation de service (' || COALESCE(NEW.service_type::text,'service') || ')',
       NEW.id, 'service_instance', v_new_balance, now() + INTERVAL '2 years');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_earn_loyalty_on_service_activation ON public.service_instances;
CREATE TRIGGER trg_earn_loyalty_on_service_activation
AFTER INSERT OR UPDATE OF status ON public.service_instances
FOR EACH ROW EXECUTE FUNCTION public.fn_earn_loyalty_on_service_activation();

-- 3) Referral qualified: +300 to referrer account
CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_on_referral_qualified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id UUID;
  v_new_balance INTEGER;
  v_already INT;
BEGIN
  IF NEW.status::text = 'qualified'
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'qualified')
     AND NEW.referrer_account_id IS NOT NULL THEN

    SELECT count(*) INTO v_already
    FROM public.loyalty_transactions
    WHERE reference_type = 'client_referral'
      AND reference_id   = NEW.id
      AND type = 'earned_referral';
    IF v_already > 0 THEN
      RETURN NEW;
    END IF;

    SELECT client_id INTO v_client_id FROM public.accounts WHERE id = NEW.referrer_account_id;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (NEW.referrer_account_id, v_client_id, 300, 300, 300)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points     = public.loyalty_points.total_points     + 300,
          available_points = public.loyalty_points.available_points + 300,
          lifetime_points  = public.loyalty_points.lifetime_points  + 300,
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions
      (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES
      (NEW.referrer_account_id, 'earned_referral', 300,
       'Parrainage activé', NEW.id, 'client_referral',
       v_new_balance, now() + INTERVAL '2 years');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_earn_loyalty_on_referral_qualified ON public.client_referrals;
CREATE TRIGGER trg_earn_loyalty_on_referral_qualified
AFTER INSERT OR UPDATE OF status ON public.client_referrals
FOR EACH ROW EXECUTE FUNCTION public.fn_earn_loyalty_on_referral_qualified();

-- 4) Anniversary function (idempotent per year), callable by cron/RPC
CREATE OR REPLACE FUNCTION public.award_account_anniversary_points()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_years INT;
  v_new_balance INT;
  v_awarded INT := 0;
BEGIN
  FOR r IN
    SELECT a.id AS account_id, a.client_id, a.created_at
    FROM public.accounts a
    WHERE a.created_at IS NOT NULL
      AND a.status IN ('active','pending')
      AND EXTRACT(MONTH FROM a.created_at) = EXTRACT(MONTH FROM now())
      AND EXTRACT(DAY   FROM a.created_at) = EXTRACT(DAY   FROM now())
      AND a.created_at::date < now()::date
  LOOP
    v_years := EXTRACT(YEAR FROM age(now(), r.created_at))::int;
    IF v_years < 1 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE account_id = r.account_id
        AND type = 'earned_anniversary'
        AND created_at::date = now()::date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (r.account_id, r.client_id, 100, 100, 100)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points = public.loyalty_points.total_points + 100,
          available_points = public.loyalty_points.available_points + 100,
          lifetime_points = public.loyalty_points.lifetime_points + 100,
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions
      (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES
      (r.account_id, 'earned_anniversary', 100,
       'Anniversaire de compte (année ' || v_years || ')',
       r.account_id, 'account', v_new_balance, now() + INTERVAL '2 years');

    v_awarded := v_awarded + 1;
  END LOOP;
  RETURN v_awarded;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.award_account_anniversary_points() TO service_role;

-- 5) Rewards catalog — new thresholds
UPDATE public.loyalty_rewards SET is_active = false;

INSERT INTO public.loyalty_rewards
  (name_fr, name_en, description_fr, description_en, reward_type, reward_value, points_required, is_active)
VALUES
  ('Crédit de 5 $', '$5 credit', 'Crédit appliqué à votre prochaine facture', 'Credit on your next invoice',
   'credit', 5,  750,  true),
  ('Crédit de 10 $', '$10 credit', 'Crédit appliqué à votre prochaine facture', 'Credit on your next invoice',
   'credit', 10, 1500, true),
  ('Crédit de 25 $', '$25 credit', 'Crédit appliqué à votre prochaine facture', 'Credit on your next invoice',
   'credit', 25, 3500, true),
  ('Rabais 5 $/mois pendant 3 mois', '$5/month discount for 3 months',
   'Rabais récurrent appliqué automatiquement pendant 3 cycles', 'Recurring discount applied for 3 billing cycles',
   'discount', 5, 4000, true),
  ('1 mois de service gratuit', '1 month free service',
   'Un cycle de facturation offert (forfait principal)', 'One free billing cycle (main plan)',
   'free_month', 0, 8000, true);