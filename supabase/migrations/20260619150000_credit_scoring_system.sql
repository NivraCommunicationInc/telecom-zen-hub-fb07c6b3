-- ============================================================
-- SYSTÈME DE SCORE DE CRÉDIT INTERNE — NIVRA TELECOM
-- Score 0-100 basé sur historique Nivra (100 = excellent)
-- Nouveau client sans historique = 50/100 (neutre)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Table account_credit_scores
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_credit_scores (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid        NOT NULL UNIQUE,
  account_id        uuid,
  current_score     integer     NOT NULL DEFAULT 50,
  credit_grade      text        NOT NULL DEFAULT 'C',
  grade_label       text        NOT NULL DEFAULT 'Moyen',
  factors           jsonb       NOT NULL DEFAULT '{}',
  has_history       boolean     NOT NULL DEFAULT false,
  invoices_paid     integer     NOT NULL DEFAULT 0,
  invoices_overdue  integer     NOT NULL DEFAULT 0,
  invoices_bad_debt integer     NOT NULL DEFAULT 0,
  chargebacks       integer     NOT NULL DEFAULT 0,
  account_age_days  integer     NOT NULL DEFAULT 0,
  last_assessed_at  timestamptz NOT NULL DEFAULT NOW(),
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_credit_scores_client_id ON public.account_credit_scores(client_id);
ALTER TABLE public.account_credit_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass credit scores" ON public.account_credit_scores
  USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- 2. Table credit_check_requests (structure pour service externe futur)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_check_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        NOT NULL,
  order_id        uuid,
  requested_at    timestamptz NOT NULL DEFAULT NOW(),
  provider        text,           -- NULL pour l'instant, futur: 'equifax','transunion'
  external_score  integer,        -- NULL pour l'instant — score bureau externe
  internal_score  integer         NOT NULL,
  status          text            NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('pending','completed','skipped')),
  result          jsonb,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_check_requests_client_id ON public.credit_check_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_check_requests_order_id  ON public.credit_check_requests(order_id);
ALTER TABLE public.credit_check_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass credit requests" ON public.credit_check_requests
  USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- 3. Fonction calculate_credit_score(p_client_id uuid)
--    Retourne jsonb avec score, grade, factors, détails
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_credit_score(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score                    integer := 50;  -- base: nouveau client neutre
  v_factors                  jsonb   := '{}';
  v_customer_id              uuid;
  v_account_age_days         integer := 0;
  v_invoices_paid            integer := 0;
  v_invoices_overdue         integer := 0;
  v_invoices_serious_overdue integer := 0;
  v_invoices_bad_debt        integer := 0;
  v_accounts_cancelled       integer := 0;
  v_accounts_good_standing   integer := 0;
  v_chargebacks              integer := 0;
  v_has_history              boolean := false;
  v_grade                    text;
  v_grade_label              text;
BEGIN
  -- ── Résoudre billing_customer ────────────────────────────────
  SELECT id INTO v_customer_id
  FROM billing_customers WHERE user_id = p_client_id LIMIT 1;

  -- ── 1. Ancienneté du compte (oldest account) ────────────────
  SELECT EXTRACT(DAY FROM (NOW() - MIN(created_at)))::integer
  INTO v_account_age_days
  FROM accounts WHERE client_id = p_client_id;
  v_account_age_days := COALESCE(v_account_age_days, 0);

  IF v_account_age_days > 0 THEN
    v_has_history := true;
    IF v_account_age_days >= 730 THEN
      v_score := v_score + 15;
      v_factors := v_factors || '{"anciennete_2ans": 15}'::jsonb;
    ELSIF v_account_age_days >= 365 THEN
      v_score := v_score + 10;
      v_factors := v_factors || '{"anciennete_1an": 10}'::jsonb;
    ELSIF v_account_age_days >= 180 THEN
      v_score := v_score + 5;
      v_factors := v_factors || '{"anciennete_6mois": 5}'::jsonb;
    END IF;
  END IF;

  -- ── 2. Historique de factures ────────────────────────────────
  IF v_customer_id IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE status IN ('paid','paid_by_promo','refunded')),
      COUNT(*) FILTER (
        WHERE status NOT IN ('paid','paid_by_promo','void','cancelled','refunded','bad_debt','written_off')
          AND COALESCE(balance_due, 0) > 0
          AND due_date < NOW() - INTERVAL '5 days'
      ),
      COUNT(*) FILTER (
        WHERE status NOT IN ('paid','paid_by_promo','void','cancelled','refunded','bad_debt','written_off')
          AND COALESCE(balance_due, 0) > 0
          AND due_date < NOW() - INTERVAL '90 days'
      ),
      COUNT(*) FILTER (WHERE status IN ('bad_debt','written_off'))
    INTO v_invoices_paid, v_invoices_overdue, v_invoices_serious_overdue, v_invoices_bad_debt
    FROM billing_invoices
    WHERE customer_id = v_customer_id;

    v_invoices_paid            := COALESCE(v_invoices_paid, 0);
    v_invoices_overdue         := COALESCE(v_invoices_overdue, 0);
    v_invoices_serious_overdue := COALESCE(v_invoices_serious_overdue, 0);
    v_invoices_bad_debt        := COALESCE(v_invoices_bad_debt, 0);

    IF (v_invoices_paid + v_invoices_overdue + v_invoices_bad_debt) > 0 THEN
      v_has_history := true;
    END IF;

    -- Factures payées → points positifs
    IF v_invoices_paid >= 12 THEN
      v_score := v_score + 20;
      v_factors := v_factors || jsonb_build_object('paiements_ponctuels', 20);
    ELSIF v_invoices_paid >= 6 THEN
      v_score := v_score + 13;
      v_factors := v_factors || jsonb_build_object('paiements_ponctuels', 13);
    ELSIF v_invoices_paid >= 3 THEN
      v_score := v_score + 8;
      v_factors := v_factors || jsonb_build_object('paiements_ponctuels', 8);
    ELSIF v_invoices_paid >= 1 THEN
      v_score := v_score + 3;
      v_factors := v_factors || jsonb_build_object('paiements_ponctuels', 3);
    END IF;

    -- Factures en retard actuelles → pénalité
    IF v_invoices_overdue >= 3 THEN
      v_score := v_score - 25;
      v_factors := v_factors || jsonb_build_object('factures_overdue', -25);
    ELSIF v_invoices_overdue >= 1 THEN
      v_score := v_score - 12;
      v_factors := v_factors || jsonb_build_object('factures_overdue', -12);
    END IF;

    -- Sérieusement en retard (90+ jours)
    IF v_invoices_serious_overdue >= 1 THEN
      v_score := v_score - 10;
      v_factors := v_factors || jsonb_build_object('factures_serieusement_overdue', -10);
    END IF;

    -- Créances irrécouvrables → grosse pénalité
    IF v_invoices_bad_debt >= 2 THEN
      v_score := v_score - 40;
      v_factors := v_factors || jsonb_build_object('factures_non_payees', -40);
    ELSIF v_invoices_bad_debt >= 1 THEN
      v_score := v_score - 25;
      v_factors := v_factors || jsonb_build_object('factures_non_payees', -25);
    END IF;

    -- ── 3. Chargebacks ─────────────────────────────────────────
    SELECT COALESCE(COUNT(*), 0) INTO v_chargebacks
    FROM billing_payments
    WHERE customer_id = v_customer_id
      AND status IN ('chargeback','disputed','reversed');

    IF v_chargebacks >= 2 THEN
      v_score := v_score - 35;
      v_factors := v_factors || jsonb_build_object('chargebacks', -35);
      v_has_history := true;
    ELSIF v_chargebacks >= 1 THEN
      v_score := v_score - 20;
      v_factors := v_factors || jsonb_build_object('chargebacks', -20);
      v_has_history := true;
    END IF;
  END IF;

  -- ── 4. Historique de comptes ─────────────────────────────────
  SELECT COALESCE(COUNT(*), 0) INTO v_accounts_cancelled
  FROM accounts WHERE client_id = p_client_id AND status = 'cancelled';

  IF v_accounts_cancelled >= 2 THEN
    v_score := v_score - 30;
    v_factors := v_factors || jsonb_build_object('comptes_annules', -30);
    v_has_history := true;
  ELSIF v_accounts_cancelled >= 1 THEN
    v_score := v_score - 15;
    v_factors := v_factors || jsonb_build_object('comptes_annules', -15);
    v_has_history := true;
  END IF;

  -- Comptes actifs depuis 3+ mois = bon standing
  SELECT COALESCE(COUNT(*), 0) INTO v_accounts_good_standing
  FROM accounts
  WHERE client_id = p_client_id
    AND status IN ('active','suspended')
    AND created_at < NOW() - INTERVAL '3 months';

  IF v_accounts_good_standing >= 1 THEN
    v_score := v_score + 5;
    v_factors := v_factors || '{"comptes_bon_standing": 5}'::jsonb;
    v_has_history := true;
  END IF;

  -- ── Plafonner 0-100 ──────────────────────────────────────────
  v_score := GREATEST(0, LEAST(100, v_score));

  -- ── Grade ────────────────────────────────────────────────────
  IF    v_score >= 80 THEN v_grade := 'A'; v_grade_label := 'Excellent';
  ELSIF v_score >= 65 THEN v_grade := 'B'; v_grade_label := 'Bon';
  ELSIF v_score >= 50 THEN v_grade := 'C'; v_grade_label := 'Moyen';
  ELSIF v_score >= 35 THEN v_grade := 'D'; v_grade_label := 'Faible';
  ELSE                     v_grade := 'F'; v_grade_label := 'Très faible';
  END IF;

  RETURN jsonb_build_object(
    'score',               v_score,
    'grade',               v_grade,
    'grade_label',         v_grade_label,
    'factors',             v_factors,
    'has_history',         v_has_history,
    'invoices_paid',       v_invoices_paid,
    'invoices_overdue',    v_invoices_overdue,
    'invoices_bad_debt',   v_invoices_bad_debt,
    'chargebacks',         v_chargebacks,
    'account_age_days',    v_account_age_days,
    'assessed_at',         NOW()
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 4. Mise à jour du trigger fraude — intègre aussi le crédit
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fraud_score_on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fraud_result    jsonb;
  v_credit_result   jsonb;
  v_fraud_score     integer;
  v_fraud_level     text;
  v_fraud_blocked   boolean;
  v_credit_score    integer;
  v_credit_grade    text;
  v_combined_blocked  boolean;
  v_combined_decision text;
  v_final_flags     jsonb;
  v_account_id      uuid;
BEGIN
  -- ── Calcul fraude (existant) ─────────────────────────────────
  v_fraud_result  := public.calculate_fraud_score(NEW.id);
  v_fraud_score   := (v_fraud_result->>'score')::integer;
  v_fraud_level   := v_fraud_result->>'level';
  v_fraud_blocked := (v_fraud_result->>'blocked')::boolean;

  -- ── Calcul crédit (nouveau) ──────────────────────────────────
  v_credit_result := public.calculate_credit_score(NEW.user_id);
  v_credit_score  := (v_credit_result->>'score')::integer;
  v_credit_grade  := v_credit_result->>'grade';

  -- ── Décision combinée ────────────────────────────────────────
  -- Règle 1 : crédit < 30 ET fraude > 50 → blocage
  -- Règle 2 : crédit < 30 seul → flag manuel (pas bloqué)
  v_combined_blocked := v_fraud_blocked OR (v_credit_score < 30 AND v_fraud_score > 50);
  IF    v_combined_blocked      THEN v_combined_decision := 'blocked';
  ELSIF v_credit_score < 30     THEN v_combined_decision := 'flag_manual';
  ELSE                               v_combined_decision := 'normal';
  END IF;

  -- ── Fusionner dans risk_flags ────────────────────────────────
  v_final_flags := v_fraud_result || jsonb_build_object(
    'credit', jsonb_build_object(
      'score',       v_credit_score,
      'grade',       v_credit_grade,
      'grade_label', v_credit_result->>'grade_label',
      'has_history', (v_credit_result->>'has_history')::boolean,
      'factors',     v_credit_result->'factors'
    ),
    'combined_decision', v_combined_decision,
    'combined_blocked',  v_combined_blocked
  );

  -- Réécrire blocked avec la décision combinée
  v_final_flags := jsonb_set(v_final_flags, '{blocked}', to_jsonb(v_combined_blocked));

  UPDATE orders SET risk_flags = v_final_flags WHERE id = NEW.id;

  -- ── Résoudre account_id ──────────────────────────────────────
  v_account_id := NEW.account_id;
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM accounts WHERE client_id = NEW.user_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- ── Upsert account_risk_scores (fraude) ─────────────────────
  IF EXISTS (SELECT 1 FROM account_risk_scores WHERE client_id = NEW.user_id) THEN
    UPDATE account_risk_scores SET
      current_score    = v_fraud_score,
      risk_level       = v_fraud_level,
      factors          = v_fraud_result->'flags',
      last_assessed_at = NOW(),
      updated_at       = NOW()
    WHERE client_id = NEW.user_id;
  ELSE
    INSERT INTO account_risk_scores
      (client_id, account_id, current_score, risk_level, factors, last_assessed_at)
    VALUES
      (NEW.user_id, v_account_id, v_fraud_score, v_fraud_level, v_fraud_result->'flags', NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── Upsert account_credit_scores (crédit) ───────────────────
  INSERT INTO account_credit_scores
    (client_id, account_id, current_score, credit_grade, grade_label, factors, has_history,
     invoices_paid, invoices_overdue, invoices_bad_debt, chargebacks, account_age_days,
     last_assessed_at, updated_at)
  VALUES (
    NEW.user_id,
    v_account_id,
    v_credit_score,
    v_credit_grade,
    v_credit_result->>'grade_label',
    COALESCE(v_credit_result->'factors', '{}'),
    (v_credit_result->>'has_history')::boolean,
    COALESCE((v_credit_result->>'invoices_paid')::integer, 0),
    COALESCE((v_credit_result->>'invoices_overdue')::integer, 0),
    COALESCE((v_credit_result->>'invoices_bad_debt')::integer, 0),
    COALESCE((v_credit_result->>'chargebacks')::integer, 0),
    COALESCE((v_credit_result->>'account_age_days')::integer, 0),
    NOW(),
    NOW()
  )
  ON CONFLICT (client_id) DO UPDATE SET
    account_id       = EXCLUDED.account_id,
    current_score    = EXCLUDED.current_score,
    credit_grade     = EXCLUDED.credit_grade,
    grade_label      = EXCLUDED.grade_label,
    factors          = EXCLUDED.factors,
    has_history      = EXCLUDED.has_history,
    invoices_paid    = EXCLUDED.invoices_paid,
    invoices_overdue = EXCLUDED.invoices_overdue,
    invoices_bad_debt= EXCLUDED.invoices_bad_debt,
    chargebacks      = EXCLUDED.chargebacks,
    account_age_days = EXCLUDED.account_age_days,
    last_assessed_at = NOW(),
    updated_at       = NOW();

  -- ── Enregistrer la demande de vérification crédit ───────────
  INSERT INTO credit_check_requests
    (client_id, order_id, provider, internal_score, status, result)
  VALUES
    (NEW.user_id, NEW.id, NULL, v_credit_score, 'completed', v_credit_result);

  -- ── Incident de fraude si score >= 80 ────────────────────────
  IF v_fraud_score >= 80 OR v_combined_blocked THEN
    INSERT INTO account_fraud_incidents
      (client_id, account_id, incident_type, severity, description, status, risk_score_delta, detected_at)
    VALUES (
      NEW.user_id,
      v_account_id,
      CASE WHEN v_combined_blocked AND NOT v_fraud_blocked THEN 'credit_block' ELSE 'high_risk_order' END,
      'high',
      CASE
        WHEN v_combined_blocked AND NOT v_fraud_blocked
          THEN 'Bloqué: crédit ' || v_credit_score || '/100 + fraude ' || v_fraud_score || '/100 — commande #' || COALESCE(NEW.order_number, left(NEW.id::text, 8))
        ELSE
          'Score fraude ' || v_fraud_score || '/100 — commande #' || COALESCE(NEW.order_number, left(NEW.id::text, 8))
      END,
      'open',
      v_fraud_score,
      NOW()
    );
  END IF;

  RETURN NULL;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 5. Backfill — calcule les scores de crédit pour tous les
--    clients existants ayant de l'historique
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  r         RECORD;
  v_result  jsonb;
  v_account_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT p.user_id AS client_id
    FROM profiles p
    WHERE p.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM account_credit_scores cs WHERE cs.client_id = p.user_id
      )
      AND (
        -- A des factures
        EXISTS (
          SELECT 1 FROM billing_customers bc
          JOIN billing_invoices bi ON bi.customer_id = bc.id
          WHERE bc.user_id = p.user_id LIMIT 1
        )
        -- OU a un compte de 30+ jours
        OR EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.client_id = p.user_id
            AND a.created_at < NOW() - INTERVAL '30 days'
          LIMIT 1
        )
      )
    LIMIT 2000
  LOOP
    BEGIN
      v_result := public.calculate_credit_score(r.client_id);

      SELECT id INTO v_account_id FROM accounts
      WHERE client_id = r.client_id ORDER BY created_at DESC LIMIT 1;

      INSERT INTO account_credit_scores
        (client_id, account_id, current_score, credit_grade, grade_label, factors, has_history,
         invoices_paid, invoices_overdue, invoices_bad_debt, chargebacks, account_age_days, last_assessed_at)
      VALUES (
        r.client_id,
        v_account_id,
        (v_result->>'score')::integer,
        v_result->>'grade',
        v_result->>'grade_label',
        COALESCE(v_result->'factors', '{}'),
        (v_result->>'has_history')::boolean,
        COALESCE((v_result->>'invoices_paid')::integer, 0),
        COALESCE((v_result->>'invoices_overdue')::integer, 0),
        COALESCE((v_result->>'invoices_bad_debt')::integer, 0),
        COALESCE((v_result->>'chargebacks')::integer, 0),
        COALESCE((v_result->>'account_age_days')::integer, 0),
        NOW()
      )
      ON CONFLICT (client_id) DO UPDATE SET
        current_score    = EXCLUDED.current_score,
        credit_grade     = EXCLUDED.credit_grade,
        grade_label      = EXCLUDED.grade_label,
        factors          = EXCLUDED.factors,
        has_history      = EXCLUDED.has_history,
        invoices_paid    = EXCLUDED.invoices_paid,
        invoices_overdue = EXCLUDED.invoices_overdue,
        invoices_bad_debt= EXCLUDED.invoices_bad_debt,
        chargebacks      = EXCLUDED.chargebacks,
        account_age_days = EXCLUDED.account_age_days,
        last_assessed_at = NOW(),
        updated_at       = NOW();
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;
