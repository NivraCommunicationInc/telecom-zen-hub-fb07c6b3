-- ============================================================
-- SYSTÈME ANTI-FRAUDE NIVRA
-- Fonction calculate_fraud_score + trigger + backfill
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Fonction principale de scoring
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_fraud_score(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order           RECORD;
  v_profile_created timestamptz;
  v_score           integer := 0;
  v_flags           jsonb   := '{}'::jsonb;
  v_email_domain    text;
  v_incident_count  integer := 0;
  v_recent_orders   integer := 0;
  v_account_age_h   numeric;
  v_order_hour      integer;
  v_level           text;
  v_blocked         boolean;
  v_phone_digits    text;

  DISPOSABLE_DOMAINS CONSTANT text[] := ARRAY[
    'mailinator.com','guerrillamail.com','guerrillamail.info','guerrillamail.net',
    'guerrillamail.org','10minutemail.com','10minutemail.net','tempmail.com',
    'tempmail.org','throwaway.email','yopmail.com','yopmail.fr','sharklasers.com',
    'trashmail.com','trashmail.at','trashmail.io','trashmail.me','trashmail.net',
    'dispostable.com','mailnull.com','maildrop.cc','fakeinbox.com',
    'tempr.email','discard.email','spamex.com','mailnesia.com','mailbucket.org',
    'spam4.me','deadaddress.com','nwytg.com','throwam.com','safetymail.info',
    'filzmail.com','sogetthis.com','getairmail.com','spamgourmet.com',
    'nowmymail.com','trashmail.xyz','temp-mail.org','temp-mail.io',
    'tempinbox.com','mailtemp.net','moakt.com','spamfree24.org'
  ];
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('score',0,'level','none','flags','{}'::jsonb,'blocked',false);
  END IF;

  -- ── RÈGLE 1 : Email jetable ──────────────────────────────
  IF v_order.client_email IS NOT NULL THEN
    v_email_domain := lower(split_part(v_order.client_email, '@', 2));
    IF v_email_domain = ANY(DISPOSABLE_DOMAINS) THEN
      v_score := v_score + 35;
      v_flags := v_flags || '{"email_jetable":35}'::jsonb;
    END IF;
  END IF;

  -- ── RÈGLE 2 : Âge du compte au moment de la commande ────
  SELECT created_at INTO v_profile_created
  FROM profiles WHERE user_id = v_order.user_id LIMIT 1;

  IF v_profile_created IS NOT NULL THEN
    v_account_age_h := EXTRACT(EPOCH FROM (v_order.created_at - v_profile_created)) / 3600.0;
    IF v_account_age_h < 1 THEN
      -- Compte créé < 1h avant la commande
      v_score := v_score + 25;
      v_flags := v_flags || '{"compte_moins_1h":25}'::jsonb;
    ELSIF v_account_age_h < 24 THEN
      -- Compte créé le même jour
      v_score := v_score + 15;
      v_flags := v_flags || '{"compte_meme_jour":15}'::jsonb;
    END IF;
  END IF;

  -- ── RÈGLE 3 : Incidents de fraude précédents ─────────────
  SELECT COUNT(*) INTO v_incident_count
  FROM account_fraud_incidents
  WHERE client_id = v_order.user_id
    AND status IN ('open','confirmed')
    AND detected_at > NOW() - INTERVAL '6 months';
  IF v_incident_count >= 2 THEN
    v_score := v_score + 60;
    v_flags := v_flags || jsonb_build_object('incidents_fraude', 60);
  ELSIF v_incident_count = 1 THEN
    v_score := v_score + 40;
    v_flags := v_flags || '{"incidents_fraude":40}'::jsonb;
  END IF;

  -- ── RÈGLE 4 : Heure inhabituelle (3h–5h heure de Montréal)
  v_order_hour := EXTRACT(HOUR FROM (v_order.created_at AT TIME ZONE 'America/Montreal'));
  IF v_order_hour >= 3 AND v_order_hour < 5 THEN
    v_score := v_score + 10;
    v_flags := v_flags || '{"heure_suspecte":10}'::jsonb;
  END IF;

  -- ── RÈGLE 5 : Commandes multiples en 24h (même user) ─────
  SELECT COUNT(*) INTO v_recent_orders
  FROM orders
  WHERE user_id = v_order.user_id
    AND id <> p_order_id
    AND created_at > v_order.created_at - INTERVAL '24 hours'
    AND created_at <= v_order.created_at;
  IF v_recent_orders >= 2 THEN
    v_score := v_score + 30;
    v_flags := v_flags || '{"commandes_multiples_24h":30}'::jsonb;
  ELSIF v_recent_orders = 1 THEN
    v_score := v_score + 15;
    v_flags := v_flags || '{"commandes_multiples_24h":15}'::jsonb;
  END IF;

  -- ── RÈGLE 6 : Téléphone absent ou invalide ────────────────
  IF v_order.client_phone IS NULL OR trim(v_order.client_phone) = '' THEN
    v_score := v_score + 15;
    v_flags := v_flags || '{"telephone_manquant":15}'::jsonb;
  ELSE
    v_phone_digits := regexp_replace(v_order.client_phone, '[^0-9]', '', 'g');
    IF NOT (v_phone_digits ~ '^1?[2-9][0-9]{9}$') THEN
      v_score := v_score + 15;
      v_flags := v_flags || '{"telephone_invalide":15}'::jsonb;
    END IF;
  END IF;

  -- ── RÈGLE 7 : Province hors QC ───────────────────────────
  IF v_order.shipping_province IS NOT NULL
     AND lower(v_order.shipping_province) NOT IN ('qc','québec','quebec') THEN
    v_score := v_score + 10;
    v_flags := v_flags || '{"province_hors_qc":10}'::jsonb;
  END IF;

  -- Plafonner à 100
  v_score := LEAST(v_score, 100);

  -- Niveau de risque
  IF    v_score >= 80 THEN v_level := 'blocked'; v_blocked := true;
  ELSIF v_score >= 60 THEN v_level := 'high';    v_blocked := false;
  ELSIF v_score >= 30 THEN v_level := 'medium';  v_blocked := false;
  ELSIF v_score >= 10 THEN v_level := 'low';     v_blocked := false;
  ELSE                     v_level := 'none';    v_blocked := false;
  END IF;

  RETURN jsonb_build_object(
    'score',       v_score,
    'level',       v_level,
    'flags',       v_flags,
    'blocked',     v_blocked,
    'assessed_at', NOW()
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 2. Fonction trigger
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fraud_score_on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result      jsonb;
  v_score       integer;
  v_level       text;
  v_account_id  uuid;
BEGIN
  -- Calcul du score
  v_result  := public.calculate_fraud_score(NEW.id);
  v_score   := (v_result->>'score')::integer;
  v_level   := v_result->>'level';

  -- Écrire le résultat dans orders.risk_flags
  UPDATE orders SET risk_flags = v_result WHERE id = NEW.id;

  -- Résoudre account_id
  v_account_id := NEW.account_id;
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM accounts WHERE client_id = NEW.user_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Upsert account_risk_scores
  IF EXISTS (SELECT 1 FROM account_risk_scores WHERE client_id = NEW.user_id) THEN
    UPDATE account_risk_scores SET
      current_score    = v_score,
      risk_level       = v_level,
      factors          = v_result->'flags',
      last_assessed_at = NOW(),
      updated_at       = NOW()
    WHERE client_id = NEW.user_id;
  ELSE
    INSERT INTO account_risk_scores
      (client_id, account_id, current_score, risk_level, factors, last_assessed_at)
    VALUES
      (NEW.user_id, v_account_id, v_score, v_level, v_result->'flags', NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Si score >= 80 : créer un incident de fraude
  IF v_score >= 80 THEN
    INSERT INTO account_fraud_incidents
      (client_id, account_id, incident_type, severity, description, status, risk_score_delta, detected_at)
    VALUES (
      NEW.user_id,
      v_account_id,
      'high_risk_order',
      'high',
      'Score de fraude ' || v_score || '/100 — commande #' || COALESCE(NEW.order_number, left(NEW.id::text, 8)),
      'open',
      v_score,
      NOW()
    );
  END IF;

  RETURN NULL;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 3. Trigger sur orders (AFTER INSERT)
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_fraud_score_on_order_insert ON orders;
CREATE TRIGGER trg_fraud_score_on_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fraud_score_on_order_insert();


-- ──────────────────────────────────────────────────────────────
-- 4. Backfill — commandes non terminées sans score de fraude
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  v_result jsonb;
  v_score  integer;
  v_level  text;
  v_account_id uuid;
BEGIN
  FOR r IN
    SELECT id, user_id, account_id, order_number
    FROM orders
    WHERE status NOT IN ('activated','completed','cancelled','delivered','installation_completed')
      AND (risk_flags IS NULL OR risk_flags = '[]'::jsonb OR jsonb_typeof(risk_flags) = 'array')
  LOOP
    BEGIN
      v_result     := public.calculate_fraud_score(r.id);
      v_score      := (v_result->>'score')::integer;
      v_level      := v_result->>'level';
      v_account_id := r.account_id;

      IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id FROM accounts WHERE client_id = r.user_id
        ORDER BY created_at DESC LIMIT 1;
      END IF;

      UPDATE orders SET risk_flags = v_result WHERE id = r.id;

      IF EXISTS (SELECT 1 FROM account_risk_scores WHERE client_id = r.user_id) THEN
        UPDATE account_risk_scores SET
          current_score    = v_score,
          risk_level       = v_level,
          factors          = v_result->'flags',
          last_assessed_at = NOW(),
          updated_at       = NOW()
        WHERE client_id = r.user_id;
      ELSE
        INSERT INTO account_risk_scores
          (client_id, account_id, current_score, risk_level, factors, last_assessed_at)
        VALUES
          (r.user_id, v_account_id, v_score, v_level, v_result->'flags', NOW())
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_score >= 80 THEN
        INSERT INTO account_fraud_incidents
          (client_id, account_id, incident_type, severity, description, status, risk_score_delta, detected_at)
        VALUES (
          r.user_id, v_account_id, 'high_risk_order', 'high',
          'Score de fraude ' || v_score || '/100 — commande #' || COALESCE(r.order_number, left(r.id::text, 8)),
          'open', v_score, NOW()
        )
        ON CONFLICT DO NOTHING;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Ignorer les erreurs par commande pour ne pas bloquer le backfill
      NULL;
    END;
  END LOOP;
END;
$$;
