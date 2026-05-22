
ALTER TABLE referral_codes ALTER COLUMN influencer_id DROP NOT NULL;

ALTER TABLE referral_program_settings
  ADD COLUMN IF NOT EXISTS required_cycles INTEGER NOT NULL DEFAULT 2;

UPDATE referral_program_settings SET
  commission_value_default = 25.00,
  required_cycles = 2,
  cooldown_days = 30
WHERE id = '88176000-247f-4f8c-880b-bce270916873';

ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS owner_account_id UUID,
  ADD COLUMN IF NOT EXISTS owner_user_id    UUID,
  ADD COLUMN IF NOT EXISTS code_type        TEXT DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS referred_discount_months INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS referred_discount_amount NUMERIC(10,2) DEFAULT 5.00;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='referral_codes_code_type_chk') THEN
    ALTER TABLE referral_codes
      ADD CONSTRAINT referral_codes_code_type_chk
      CHECK (code_type IN ('client','influencer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='referral_codes_owner_or_influencer_chk') THEN
    ALTER TABLE referral_codes
      ADD CONSTRAINT referral_codes_owner_or_influencer_chk
      CHECK (owner_user_id IS NOT NULL OR influencer_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner_user_id    ON referral_codes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner_account_id ON referral_codes(owner_account_id);

ALTER TABLE client_referrals
  ADD COLUMN IF NOT EXISTS payment_method          TEXT,
  ADD COLUMN IF NOT EXISTS payment_email           TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference       TEXT,
  ADD COLUMN IF NOT EXISTS discount_applied_months INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total_months   INTEGER DEFAULT 10;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='client_referrals_payment_method_chk') THEN
    ALTER TABLE client_referrals
      ADD CONSTRAINT client_referrals_payment_method_chk
      CHECK (payment_method IS NULL OR payment_method IN ('paypal','gift_card','interac'));
  END IF;
END $$;

ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS referral_discount_active           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_discount_amount           NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_discount_months_remaining INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code_used                 TEXT,
  ADD COLUMN IF NOT EXISTS referral_credit_id                 UUID;

CREATE OR REPLACE FUNCTION public.generate_client_referral_code(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT; v_exists BOOLEAN; v_prefix TEXT;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(COALESCE(first_name,'NIV'), '[^A-Za-z]', '', 'g'), 3))
    INTO v_prefix FROM profiles WHERE user_id = p_user_id LIMIT 1;
  IF v_prefix IS NULL OR LENGTH(v_prefix) < 2 THEN v_prefix := 'NIV'; END IF;
  LOOP
    v_code := v_prefix || '-' || UPPER(SUBSTRING(MD5(p_user_id::text || random()::text), 1, 5));
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END; $$;

DO $$
DECLARE v_account RECORD; v_code TEXT;
BEGIN
  FOR v_account IN
    SELECT a.id AS account_id, a.client_id AS user_id
      FROM accounts a
     WHERE a.status = 'active' AND a.client_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM referral_codes rc
          WHERE rc.owner_user_id = a.client_id
       )
  LOOP
    v_code := generate_client_referral_code(v_account.user_id);
    INSERT INTO referral_codes (
      influencer_id, owner_account_id, owner_user_id,
      code, code_type, status, usage_limit_total,
      referred_discount_months, referred_discount_amount
    ) VALUES (
      NULL, v_account.account_id, v_account.user_id,
      v_code, 'client', 'active', NULL, 10, 5.00
    );
    UPDATE profiles SET referral_code = v_code WHERE user_id = v_account.user_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_auto_create_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT;
BEGIN
  IF NEW.status = 'active'
     AND (OLD.status IS DISTINCT FROM 'active')
     AND NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM referral_codes WHERE owner_user_id = NEW.client_id
    ) THEN
      v_code := generate_client_referral_code(NEW.client_id);
      INSERT INTO referral_codes (
        influencer_id, owner_account_id, owner_user_id,
        code, code_type, status, usage_limit_total,
        referred_discount_months, referred_discount_amount
      ) VALUES (
        NULL, NEW.id, NEW.client_id, v_code, 'client', 'active', NULL, 10, 5.00
      );
      UPDATE profiles SET referral_code = v_code WHERE user_id = NEW.client_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_create_referral_code ON accounts;
CREATE TRIGGER trg_auto_create_referral_code
AFTER UPDATE OF status ON accounts
FOR EACH ROW EXECUTE FUNCTION fn_auto_create_referral_code();

CREATE OR REPLACE FUNCTION public.apply_referral_discount(
  p_account_id UUID, p_invoice_amount NUMERIC
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_discount NUMERIC := 0; v_sub RECORD;
BEGIN
  SELECT bs.*
    INTO v_sub
    FROM billing_subscriptions bs
    JOIN billing_customers bc ON bc.id = bs.customer_id
    JOIN accounts a           ON a.client_id = bc.user_id
   WHERE a.id = p_account_id
     AND bs.status = 'active'
     AND bs.referral_discount_active = true
     AND bs.referral_discount_months_remaining > 0
   ORDER BY bs.created_at DESC LIMIT 1;

  IF FOUND THEN
    v_discount := LEAST(v_sub.referral_discount_amount, p_invoice_amount);
    UPDATE billing_subscriptions
       SET referral_discount_months_remaining = referral_discount_months_remaining - 1,
           referral_discount_active = (referral_discount_months_remaining - 1) > 0
     WHERE id = v_sub.id;

    INSERT INTO client_referral_events (referral_id, event_type, notes)
    SELECT cr.id, 'discount_applied',
           'Rabais référence ' || v_discount::text || '$ appliqué — mois ' ||
             (10 - v_sub.referral_discount_months_remaining + 1)::text || '/10'
      FROM client_referrals cr
     WHERE cr.referred_account_id = p_account_id
       AND cr.status IS DISTINCT FROM 'disqualified'::referral_status
     LIMIT 1;
  END IF;
  RETURN v_discount;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_track_referral_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account_id UUID;
BEGIN
  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    SELECT a.id INTO v_account_id
      FROM billing_customers bc
      JOIN accounts a ON a.client_id = bc.user_id
     WHERE bc.id = NEW.customer_id LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE client_referrals
         SET qualifying_cycles_paid = qualifying_cycles_paid + 1,
             status = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles THEN 'qualified'::referral_status
               ELSE status
             END,
             qualified_at = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles THEN now()
               ELSE qualified_at
             END,
             reward_status = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles
                    AND reward_status = 'not_eligible'::referral_reward_status
                 THEN 'reward_pending'::referral_reward_status
               ELSE reward_status
             END
       WHERE referred_account_id = v_account_id
         AND status NOT IN ('disqualified'::referral_status, 'rewarded'::referral_status);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_track_referral_payment ON billing_subscriptions;
CREATE TRIGGER trg_track_referral_payment
AFTER UPDATE OF status ON billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION fn_track_referral_payment();
