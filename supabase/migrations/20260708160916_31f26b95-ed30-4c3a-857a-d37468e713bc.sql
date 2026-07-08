
-- ============================================================
-- Loyalty & Referrals — Admin management RPCs (Phase Points+Ref)
-- ============================================================

-- 1) Schema additions -----------------------------------------

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_status_check'
  ) THEN
    ALTER TABLE public.loyalty_transactions
      ADD CONSTRAINT loyalty_transactions_status_check
      CHECK (status IN ('pending','approved','rejected','posted','reversed'));
  END IF;
END$$;

ALTER TABLE public.client_referrals
  ADD COLUMN IF NOT EXISTS reassigned_from uuid,
  ADD COLUMN IF NOT EXISTS reassigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS reassigned_by uuid,
  ADD COLUMN IF NOT EXISTS clawback_at timestamptz,
  ADD COLUMN IF NOT EXISTS clawback_by uuid,
  ADD COLUMN IF NOT EXISTS clawback_reason text,
  ADD COLUMN IF NOT EXISTS manual_reward boolean NOT NULL DEFAULT false;

-- 2) Helper: log admin action ---------------------------------

CREATE OR REPLACE FUNCTION public._admin_log_loyalty_or_ref(
  _actor uuid,
  _action text,
  _entity_type text,
  _entity_id uuid,
  _account_id uuid,
  _reason text,
  _old jsonb,
  _new jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE user_id = _actor;

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (_actor, _email, _action, _entity_type, _entity_id,
          jsonb_build_object('reason', _reason, 'account_id', _account_id, 'old', _old, 'new', _new));

  INSERT INTO public.activity_logs(user_id, action, entity_type, entity_id, reason, details, actor_role, actor_email,
                                   old_value, new_value)
  VALUES (_actor, _action, _entity_type, _entity_id, _reason,
          jsonb_build_object('account_id', _account_id, 'old', _old, 'new', _new),
          'admin', _email, _old::text, _new::text);
END$$;

-- 3) Ensure has_role admin guard ------------------------------

CREATE OR REPLACE FUNCTION public._require_admin() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN: admin role required' USING ERRCODE = '42501';
  END IF;
  RETURN _uid;
END$$;

-- 4) LOYALTY: adjust ------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_loyalty_adjust(
  p_account_id uuid,
  p_delta_points integer,
  p_reason text,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := public._require_admin();
  _lp public.loyalty_points%ROWTYPE;
  _new_available integer;
  _new_total integer;
  _new_lifetime integer;
  _tx_id uuid;
BEGIN
  IF p_delta_points = 0 THEN RAISE EXCEPTION 'delta must be non-zero'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _lp FROM public.loyalty_points WHERE account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.loyalty_points(account_id, total_points, available_points, lifetime_points)
    VALUES (p_account_id, 0, 0, 0)
    RETURNING * INTO _lp;
  END IF;

  _new_available := _lp.available_points + p_delta_points;
  IF _new_available < 0 THEN RAISE EXCEPTION 'insufficient points (available=%)', _lp.available_points; END IF;
  _new_total := _lp.total_points + p_delta_points;
  _new_lifetime := _lp.lifetime_points + GREATEST(p_delta_points, 0);

  UPDATE public.loyalty_points
     SET total_points = _new_total,
         available_points = _new_available,
         lifetime_points = _new_lifetime,
         updated_at = now()
   WHERE account_id = p_account_id;

  INSERT INTO public.loyalty_transactions(account_id, type, points, description, balance_after, expires_at,
                                          status, reviewed_by, reviewed_at, admin_reason)
  VALUES (p_account_id, 'adjusted', p_delta_points,
          'Ajustement admin: ' || p_reason, _new_available, p_expires_at,
          'posted', _actor, now(), p_reason)
  RETURNING id INTO _tx_id;

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'loyalty.adjust', 'loyalty_points', _lp.id,
    p_account_id, p_reason,
    jsonb_build_object('available', _lp.available_points, 'total', _lp.total_points),
    jsonb_build_object('available', _new_available, 'total', _new_total, 'tx_id', _tx_id));

  RETURN jsonb_build_object('ok', true, 'tx_id', _tx_id, 'available_points', _new_available);
END$$;

-- 5) LOYALTY: approve / reject pending ------------------------

CREATE OR REPLACE FUNCTION public.admin_loyalty_approve_pending(
  p_transaction_id uuid,
  p_decision text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _tx public.loyalty_transactions%ROWTYPE;
  _lp public.loyalty_points%ROWTYPE;
  _new_available integer;
BEGIN
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'decision must be approve|reject'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _tx FROM public.loyalty_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;
  IF _tx.status <> 'pending' THEN RAISE EXCEPTION 'transaction not pending (status=%)', _tx.status; END IF;

  SELECT * INTO _lp FROM public.loyalty_points WHERE account_id = _tx.account_id FOR UPDATE;

  IF p_decision = 'approve' THEN
    _new_available := _lp.available_points + _tx.points;
    IF _new_available < 0 THEN RAISE EXCEPTION 'insufficient balance to approve'; END IF;

    UPDATE public.loyalty_points
       SET available_points = _new_available,
           total_points = total_points + _tx.points,
           lifetime_points = lifetime_points + GREATEST(_tx.points,0),
           updated_at = now()
     WHERE account_id = _tx.account_id;

    UPDATE public.loyalty_transactions
       SET status = 'approved', reviewed_by = _actor, reviewed_at = now(),
           admin_reason = p_reason, balance_after = _new_available
     WHERE id = p_transaction_id;
  ELSE
    UPDATE public.loyalty_transactions
       SET status = 'rejected', reviewed_by = _actor, reviewed_at = now(),
           admin_reason = p_reason
     WHERE id = p_transaction_id;
  END IF;

  PERFORM public._admin_log_loyalty_or_ref(_actor,
    CASE WHEN p_decision='approve' THEN 'loyalty.approve' ELSE 'loyalty.reject' END,
    'loyalty_transaction', p_transaction_id, _tx.account_id, p_reason,
    jsonb_build_object('status','pending','points',_tx.points),
    jsonb_build_object('status', CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END));

  RETURN jsonb_build_object('ok', true, 'decision', p_decision);
END$$;

-- 6) LOYALTY: transfer ----------------------------------------

CREATE OR REPLACE FUNCTION public.admin_loyalty_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_points integer,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _from public.loyalty_points%ROWTYPE;
  _to public.loyalty_points%ROWTYPE;
  _tx_out uuid; _tx_in uuid;
BEGIN
  IF p_from_account = p_to_account THEN RAISE EXCEPTION 'from = to'; END IF;
  IF p_points <= 0 THEN RAISE EXCEPTION 'points must be > 0'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  -- lock in stable order to avoid deadlocks
  IF p_from_account < p_to_account THEN
    SELECT * INTO _from FROM public.loyalty_points WHERE account_id = p_from_account FOR UPDATE;
    SELECT * INTO _to   FROM public.loyalty_points WHERE account_id = p_to_account   FOR UPDATE;
  ELSE
    SELECT * INTO _to   FROM public.loyalty_points WHERE account_id = p_to_account   FOR UPDATE;
    SELECT * INTO _from FROM public.loyalty_points WHERE account_id = p_from_account FOR UPDATE;
  END IF;

  IF _from.account_id IS NULL THEN RAISE EXCEPTION 'source account has no loyalty record'; END IF;
  IF _from.available_points < p_points THEN RAISE EXCEPTION 'insufficient points on source'; END IF;

  IF _to.account_id IS NULL THEN
    INSERT INTO public.loyalty_points(account_id, total_points, available_points, lifetime_points)
    VALUES (p_to_account, 0, 0, 0)
    RETURNING * INTO _to;
  END IF;

  UPDATE public.loyalty_points
     SET available_points = available_points - p_points,
         total_points = total_points - p_points,
         updated_at = now()
   WHERE account_id = p_from_account;

  UPDATE public.loyalty_points
     SET available_points = available_points + p_points,
         total_points = total_points + p_points,
         lifetime_points = lifetime_points + p_points,
         updated_at = now()
   WHERE account_id = p_to_account;

  INSERT INTO public.loyalty_transactions(account_id, type, points, description, balance_after,
                                          status, reviewed_by, reviewed_at, admin_reason, reference_type)
  VALUES (p_from_account, 'adjusted', -p_points, 'Transfert sortant: ' || p_reason,
          _from.available_points - p_points, 'posted', _actor, now(), p_reason, 'transfer_out')
  RETURNING id INTO _tx_out;

  INSERT INTO public.loyalty_transactions(account_id, type, points, description, balance_after,
                                          status, reviewed_by, reviewed_at, admin_reason,
                                          reference_id, reference_type)
  VALUES (p_to_account, 'adjusted', p_points, 'Transfert entrant: ' || p_reason,
          _to.available_points + p_points, 'posted', _actor, now(), p_reason,
          _tx_out, 'transfer_in')
  RETURNING id INTO _tx_in;

  UPDATE public.loyalty_transactions SET reference_id = _tx_in WHERE id = _tx_out;

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'loyalty.transfer',
    'loyalty_transfer', _tx_out, p_from_account, p_reason,
    jsonb_build_object('from_available', _from.available_points),
    jsonb_build_object('points', p_points, 'to_account', p_to_account, 'tx_out', _tx_out, 'tx_in', _tx_in));

  RETURN jsonb_build_object('ok', true, 'tx_out', _tx_out, 'tx_in', _tx_in);
END$$;

-- 7) LOYALTY: extend expiration -------------------------------

CREATE OR REPLACE FUNCTION public.admin_loyalty_extend_expiration(
  p_transaction_id uuid,
  p_new_expires_at timestamptz,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _tx public.loyalty_transactions%ROWTYPE;
BEGIN
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;
  SELECT * INTO _tx FROM public.loyalty_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  UPDATE public.loyalty_transactions
     SET expires_at = p_new_expires_at, admin_reason = p_reason,
         reviewed_by = _actor, reviewed_at = now()
   WHERE id = p_transaction_id;

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'loyalty.extend_expiration',
    'loyalty_transaction', p_transaction_id, _tx.account_id, p_reason,
    jsonb_build_object('expires_at', _tx.expires_at),
    jsonb_build_object('expires_at', p_new_expires_at));

  RETURN jsonb_build_object('ok', true);
END$$;

-- 8) LOYALTY: convert to credit -------------------------------

CREATE OR REPLACE FUNCTION public.admin_loyalty_convert_to_credit(
  p_account_id uuid,
  p_points integer,
  p_credit_amount numeric,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _lp public.loyalty_points%ROWTYPE;
  _adj_id uuid; _tx_id uuid;
BEGIN
  IF p_points <= 0 THEN RAISE EXCEPTION 'points must be > 0'; END IF;
  IF p_credit_amount <= 0 THEN RAISE EXCEPTION 'credit amount must be > 0'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _lp FROM public.loyalty_points WHERE account_id = p_account_id FOR UPDATE;
  IF NOT FOUND OR _lp.available_points < p_points THEN
    RAISE EXCEPTION 'insufficient points';
  END IF;

  UPDATE public.loyalty_points
     SET available_points = available_points - p_points,
         total_points = total_points - p_points,
         updated_at = now()
   WHERE account_id = p_account_id;

  INSERT INTO public.loyalty_transactions(account_id, type, points, description, balance_after,
                                          status, reviewed_by, reviewed_at, admin_reason, reference_type)
  VALUES (p_account_id, 'redeemed', -p_points,
          'Conversion en crédit: ' || p_reason, _lp.available_points - p_points,
          'posted', _actor, now(), p_reason, 'convert_to_credit')
  RETURNING id INTO _tx_id;

  INSERT INTO public.account_adjustments(account_id, type, amount, description,
                                         months_total, months_remaining, created_by, is_permanent)
  VALUES (p_account_id, 'credit', p_credit_amount,
          'Crédit issu de ' || p_points || ' pts — ' || p_reason,
          1, 1, _actor, false)
  RETURNING id INTO _adj_id;

  UPDATE public.loyalty_transactions SET reference_id = _adj_id WHERE id = _tx_id;

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'loyalty.convert_to_credit',
    'loyalty_points', _lp.id, p_account_id, p_reason,
    jsonb_build_object('available', _lp.available_points),
    jsonb_build_object('available', _lp.available_points - p_points,
                      'credit_amount', p_credit_amount, 'adjustment_id', _adj_id));

  RETURN jsonb_build_object('ok', true, 'adjustment_id', _adj_id, 'tx_id', _tx_id);
END$$;

-- 9) REFERRALS: approve / reject ------------------------------

CREATE OR REPLACE FUNCTION public.admin_referral_decide(
  p_referral_id uuid,
  p_decision text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _ref public.client_referrals%ROWTYPE;
  _new_status text; _new_reward text;
BEGIN
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'decision must be approve|reject'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _ref FROM public.client_referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral not found'; END IF;

  IF p_decision = 'approve' THEN
    _new_status := 'qualified';
    _new_reward := 'eligible';
    UPDATE public.client_referrals
       SET status = 'qualified'::referral_status,
           reward_status = 'eligible'::referral_reward_status,
           qualified_at = now(),
           fraud_checked_by = _actor, fraud_checked_at = now(),
           fraud_review_notes = p_reason,
           updated_at = now()
     WHERE id = p_referral_id;
  ELSE
    _new_status := 'disqualified';
    _new_reward := 'not_eligible';
    UPDATE public.client_referrals
       SET status = 'disqualified'::referral_status,
           reward_status = 'not_eligible'::referral_reward_status,
           disqualified_at = now(),
           disqualification_reason = p_reason,
           fraud_checked_by = _actor, fraud_checked_at = now(),
           fraud_review_notes = p_reason,
           updated_at = now()
     WHERE id = p_referral_id;
  END IF;

  INSERT INTO public.client_referral_events(referral_id, event_type, old_status, new_status, details, actor_id, actor_type)
  VALUES (p_referral_id,
          CASE WHEN p_decision='approve' THEN 'admin.approved' ELSE 'admin.rejected' END,
          _ref.status::text, _new_status,
          jsonb_build_object('reason', p_reason), _actor, 'admin');

  PERFORM public._admin_log_loyalty_or_ref(_actor,
    CASE WHEN p_decision='approve' THEN 'referral.approve' ELSE 'referral.reject' END,
    'client_referral', p_referral_id, _ref.referrer_account_id, p_reason,
    jsonb_build_object('status', _ref.status::text, 'reward_status', _ref.reward_status::text),
    jsonb_build_object('status', _new_status, 'reward_status', _new_reward));

  RETURN jsonb_build_object('ok', true, 'status', _new_status);
END$$;

-- 10) REFERRALS: reassign -------------------------------------

CREATE OR REPLACE FUNCTION public.admin_referral_reassign(
  p_referral_id uuid,
  p_new_referrer_user_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _ref public.client_referrals%ROWTYPE;
  _new_account uuid;
BEGIN
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;
  SELECT * INTO _ref FROM public.client_referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral not found'; END IF;
  IF _ref.referrer_user_id = p_new_referrer_user_id THEN RAISE EXCEPTION 'same referrer'; END IF;

  SELECT id INTO _new_account FROM public.accounts WHERE client_id = p_new_referrer_user_id LIMIT 1;

  UPDATE public.client_referrals
     SET reassigned_from = referrer_user_id,
         referrer_user_id = p_new_referrer_user_id,
         referrer_account_id = _new_account,
         reassigned_at = now(),
         reassigned_by = _actor,
         notes = coalesce(notes,'') || E'\n[Réattribution ' || now()::text || ']: ' || p_reason,
         updated_at = now()
   WHERE id = p_referral_id;

  INSERT INTO public.client_referral_events(referral_id, event_type, details, actor_id, actor_type)
  VALUES (p_referral_id, 'admin.reassigned',
          jsonb_build_object('from', _ref.referrer_user_id, 'to', p_new_referrer_user_id, 'reason', p_reason),
          _actor, 'admin');

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'referral.reassign',
    'client_referral', p_referral_id, _ref.referrer_account_id, p_reason,
    jsonb_build_object('referrer_user_id', _ref.referrer_user_id),
    jsonb_build_object('referrer_user_id', p_new_referrer_user_id));

  RETURN jsonb_build_object('ok', true);
END$$;

-- 11) REFERRALS: manual reward --------------------------------

CREATE OR REPLACE FUNCTION public.admin_referral_manual_reward(
  p_referrer_user_id uuid,
  p_kind text,             -- 'points' | 'credit'
  p_value numeric,
  p_reason text,
  p_referred_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _account uuid; _result jsonb;
BEGIN
  IF p_kind NOT IN ('points','credit') THEN RAISE EXCEPTION 'kind must be points|credit'; END IF;
  IF p_value <= 0 THEN RAISE EXCEPTION 'value must be > 0'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT id INTO _account FROM public.accounts WHERE client_id = p_referrer_user_id LIMIT 1;
  IF _account IS NULL THEN RAISE EXCEPTION 'no account for referrer'; END IF;

  IF p_kind = 'points' THEN
    _result := public.admin_loyalty_adjust(_account, p_value::integer, 'Récompense référence manuelle: ' || p_reason, NULL);
  ELSE
    INSERT INTO public.account_adjustments(account_id, type, amount, description,
                                           months_total, months_remaining, created_by, is_permanent)
    VALUES (_account, 'credit', p_value,
            'Récompense référence manuelle — ' || p_reason,
            1, 1, _actor, false);
    _result := jsonb_build_object('ok', true, 'kind', 'credit');
  END IF;

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'referral.manual_reward',
    'client_referral_manual', null, _account, p_reason,
    '{}'::jsonb,
    jsonb_build_object('kind', p_kind, 'value', p_value, 'referrer', p_referrer_user_id, 'referred', p_referred_user_id));

  RETURN _result;
END$$;

-- 12) REFERRALS: clawback -------------------------------------

CREATE OR REPLACE FUNCTION public.admin_referral_clawback(
  p_referral_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := public._require_admin();
  _ref public.client_referrals%ROWTYPE;
BEGIN
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;
  SELECT * INTO _ref FROM public.client_referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral not found'; END IF;

  UPDATE public.client_referrals
     SET reward_status = 'not_eligible'::referral_reward_status,
         status = 'disqualified'::referral_status,
         clawback_at = now(),
         clawback_by = _actor,
         clawback_reason = p_reason,
         disqualification_reason = 'Clawback: ' || p_reason,
         updated_at = now()
   WHERE id = p_referral_id;

  INSERT INTO public.client_referral_events(referral_id, event_type, old_status, new_status, details, actor_id, actor_type)
  VALUES (p_referral_id, 'admin.clawback', _ref.status::text, 'disqualified',
          jsonb_build_object('reason', p_reason, 'previous_reward_status', _ref.reward_status::text),
          _actor, 'admin');

  PERFORM public._admin_log_loyalty_or_ref(_actor, 'referral.clawback',
    'client_referral', p_referral_id, _ref.referrer_account_id, p_reason,
    jsonb_build_object('reward_status', _ref.reward_status::text),
    jsonb_build_object('reward_status', 'not_eligible', 'clawback', true));

  RETURN jsonb_build_object('ok', true);
END$$;

-- 13) Grants ---------------------------------------------------

GRANT EXECUTE ON FUNCTION public.admin_loyalty_adjust(uuid, integer, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_approve_pending(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_transfer(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_extend_expiration(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_convert_to_credit(uuid, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_decide(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_reassign(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_manual_reward(uuid, text, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_clawback(uuid, text) TO authenticated;

-- 14) Realtime ------------------------------------------------

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_points; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_redemptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_referrals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_referral_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
