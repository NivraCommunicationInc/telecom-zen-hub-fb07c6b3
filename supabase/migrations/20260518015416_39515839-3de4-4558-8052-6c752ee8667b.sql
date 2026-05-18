
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID,
  total_points INTEGER NOT NULL DEFAULT 0,
  available_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  tier_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earned_payment','earned_referral','earned_activation','earned_anniversary','redeemed','expired','adjusted')),
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  balance_after INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON public.loyalty_transactions(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credit','discount','free_month','equipment','gift_card','other')),
  reward_value NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_limit INTEGER,
  redemptions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','cancelled')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own loyalty_points" ON public.loyalty_points
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));
CREATE POLICY "Admins manage loyalty_points" ON public.loyalty_points
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read own loyalty_transactions" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));
CREATE POLICY "Admins manage loyalty_transactions" ON public.loyalty_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone reads active rewards" ON public.loyalty_rewards
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins manage rewards" ON public.loyalty_rewards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read own redemptions" ON public.loyalty_redemptions
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));
CREATE POLICY "Clients create own redemptions" ON public.loyalty_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));
CREATE POLICY "Admins manage redemptions" ON public.loyalty_redemptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.loyalty_rewards (name_fr, name_en, description_fr, description_en, points_required, reward_type, reward_value) VALUES
('Crédit de 5$', '$5 Credit', '5$ crédité sur votre prochain paiement', '$5 credit on your next payment', 500, 'credit', 5.00),
('Crédit de 10$', '$10 Credit', '10$ crédité sur votre prochain paiement', '$10 credit on your next payment', 900, 'credit', 10.00),
('Crédit de 25$', '$25 Credit', '25$ crédité sur votre prochain paiement', '$25 credit on your next payment', 2000, 'credit', 25.00),
('Mois gratuit', 'Free Month', '1 mois de service offert', '1 month of service free', 3000, 'free_month', 0.00),
('Rabais 5$/mois — 3 mois', '$5/month discount — 3 months', '5$ de rabais pendant 3 mois', '$5 discount for 3 months', 1500, 'discount', 5.00)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_points_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_account_id UUID;
  v_client_id UUID;
  v_new_balance INTEGER;
BEGIN
  IF NEW.status IN ('confirmed','completed','captured','succeeded')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed','completed','captured','succeeded')) THEN
    SELECT o.account_id, a.client_id INTO v_account_id, v_client_id
    FROM public.billing_invoices bi
    LEFT JOIN public.orders o ON o.id = bi.order_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE bi.id = NEW.invoice_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_points := FLOOR(COALESCE(NEW.amount, 0) * 10)::INTEGER;
    IF v_points <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (v_account_id, v_client_id, v_points, v_points, v_points)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points = public.loyalty_points.total_points + EXCLUDED.total_points,
          available_points = public.loyalty_points.available_points + EXCLUDED.available_points,
          lifetime_points = public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
          tier = CASE
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'platinum'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 1500 THEN 'gold'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 500 THEN 'silver'
            ELSE 'bronze'
          END,
          tier_updated_at = now(),
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES (
      v_account_id,
      'earned_payment',
      v_points,
      'Points gagnés sur paiement de ' || COALESCE(NEW.amount, 0) || '$',
      NEW.id,
      'billing_payment',
      v_new_balance,
      now() + INTERVAL '2 years'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_earn_loyalty_on_payment ON public.billing_payments;
CREATE TRIGGER trg_earn_loyalty_on_payment
AFTER UPDATE ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_earn_loyalty_points_on_payment();

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(p_account_id UUID, p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_points RECORD;
  v_redemption_id UUID;
  v_new_balance INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_not_found');
  END IF;
  IF v_reward.stock_limit IS NOT NULL AND v_reward.redemptions_count >= v_reward.stock_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_stock');
  END IF;
  SELECT * INTO v_points FROM public.loyalty_points WHERE account_id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_points.available_points < v_reward.points_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_points');
  END IF;

  UPDATE public.loyalty_points
    SET available_points = available_points - v_reward.points_required,
        updated_at = now()
    WHERE account_id = p_account_id
    RETURNING available_points INTO v_new_balance;

  INSERT INTO public.loyalty_redemptions (account_id, reward_id, points_spent, status)
  VALUES (p_account_id, p_reward_id, v_reward.points_required, 'pending')
  RETURNING id INTO v_redemption_id;

  UPDATE public.loyalty_rewards SET redemptions_count = redemptions_count + 1 WHERE id = p_reward_id;

  INSERT INTO public.loyalty_transactions (account_id, type, points, description, reference_id, reference_type, balance_after)
  VALUES (p_account_id, 'redeemed', -v_reward.points_required, 'Échange: ' || v_reward.name_fr, v_redemption_id, 'loyalty_redemption', v_new_balance);

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(UUID, UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  client_id UUID,
  score INTEGER CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      WHEN score >= 0 THEN 'detractor'
      ELSE NULL
    END
  ) STORED,
  trigger_event TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage nps" ON public.nps_surveys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public submit nps via token" ON public.nps_surveys
  FOR UPDATE TO anon
  USING (responded_at IS NULL)
  WITH CHECK (true);

CREATE OR REPLACE VIEW public.mrr_metrics
WITH (security_invoker = on) AS
SELECT
  DATE_TRUNC('month', now()) AS period,
  COUNT(*) FILTER (WHERE status = 'active') AS active_subscriptions,
  COALESCE(SUM(plan_price) FILTER (WHERE status = 'active'), 0) AS mrr,
  COALESCE(SUM(plan_price) FILTER (WHERE status = 'active'), 0) * 12 AS arr,
  COALESCE(AVG(plan_price) FILTER (WHERE status = 'active'), 0) AS arpu,
  COUNT(*) AS total_subscriptions
FROM public.billing_subscriptions;

CREATE OR REPLACE VIEW public.churn_metrics
WITH (security_invoker = on) AS
WITH months AS (
  SELECT DATE_TRUNC('month', a.cancelled_at) AS month, COUNT(*) AS churned_count
  FROM public.accounts a
  WHERE a.cancelled_at IS NOT NULL
  GROUP BY DATE_TRUNC('month', a.cancelled_at)
),
denoms AS (
  SELECT m.month, m.churned_count,
    (SELECT COUNT(*) FROM public.accounts a2
     WHERE a2.created_at < m.month
       AND (a2.cancelled_at IS NULL OR a2.cancelled_at >= m.month)
    ) AS active_at_start
  FROM months m
)
SELECT month, churned_count,
  CASE WHEN active_at_start > 0 THEN (churned_count * 100.0 / active_at_start) ELSE 0 END AS churn_rate_pct
FROM denoms
ORDER BY month DESC;

CREATE OR REPLACE VIEW public.growth_metrics
WITH (security_invoker = on) AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS new_subscriptions,
  COALESCE(SUM(plan_price), 0) AS new_mrr
FROM public.billing_subscriptions
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

CREATE OR REPLACE VIEW public.nps_score
WITH (security_invoker = on) AS
SELECT
  COALESCE(
    (COUNT(*) FILTER (WHERE category = 'promoter') * 100.0 / NULLIF(COUNT(*), 0)) -
    (COUNT(*) FILTER (WHERE category = 'detractor') * 100.0 / NULLIF(COUNT(*), 0)),
    0
  ) AS nps_score,
  COUNT(*) AS total_responses,
  COUNT(*) FILTER (WHERE category = 'promoter') AS promoters,
  COUNT(*) FILTER (WHERE category = 'passive') AS passives,
  COUNT(*) FILTER (WHERE category = 'detractor') AS detractors,
  COALESCE(AVG(score), 0) AS avg_score
FROM public.nps_surveys
WHERE responded_at IS NOT NULL
  AND sent_at >= now() - INTERVAL '90 days';
