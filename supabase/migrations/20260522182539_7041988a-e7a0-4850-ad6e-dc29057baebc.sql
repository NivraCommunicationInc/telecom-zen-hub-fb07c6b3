
DO $$
DECLARE
  v_account RECORD;
  v_code TEXT;
  v_prefix TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR v_account IN
    SELECT a.id as account_id, a.client_id as user_id
    FROM accounts a
    WHERE a.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM referral_codes rc WHERE rc.owner_user_id = a.client_id
      )
  LOOP
    SELECT UPPER(LEFT(
      REGEXP_REPLACE(COALESCE(p.first_name, 'NIV'), '[^A-Za-z]', '', 'g'), 3
    )) INTO v_prefix
    FROM profiles p WHERE p.user_id = v_account.user_id;

    IF v_prefix IS NULL OR LENGTH(v_prefix) < 2 THEN
      v_prefix := 'NIV';
    END IF;

    LOOP
      v_code := v_prefix || '-' || UPPER(SUBSTRING(
        MD5(v_account.user_id::text || random()::text), 1, 5
      ));
      SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;

    INSERT INTO referral_codes (owner_user_id, owner_account_id, code, code_type, status, usage_limit_total)
    VALUES (v_account.user_id, v_account.account_id, v_code, 'client', 'active', NULL);

    UPDATE profiles SET referral_code = v_code WHERE user_id = v_account.user_id;
  END LOOP;
END $$;

UPDATE referral_program_settings
SET cooldown_days = 30, required_cycles = 2
WHERE id = '88176000-247f-4f8c-880b-bce270916873';
