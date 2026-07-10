
-- ============================================================
-- MODULE 32 — LOYAUTÉ — PHASE A (P0 Sécurisation)
-- F32-1: Retrait INSERT direct client sur loyalty_redemptions
-- F32-2/3: redeem_loyalty_reward — lock, idempotency, stock atomique
-- F32-4: Unicité earn (anti-doublon)
-- ============================================================

-- F32-1: Retirer la politique INSERT client. Seule voie: RPC redeem_loyalty_reward.
DROP POLICY IF EXISTS "Clients create own redemptions" ON public.loyalty_redemptions;

-- F32-2/3: Colonnes nécessaires + contrainte unique idempotence
ALTER TABLE public.loyalty_redemptions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_tx_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_redemptions_idem
  ON public.loyalty_redemptions(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- F32-4: Anti-doublon earn (activation, referral, paiement)
CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_tx_earn_dedup
  ON public.loyalty_transactions(account_id, type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL
    AND type IN ('earned_payment','earned_activation','earned_referral');

-- F32-2/3: Nouvelle version de redeem_loyalty_reward
-- - SELECT FOR UPDATE sur loyalty_rewards (verrouillage stock)
-- - idempotency_key obligatoire
-- - atomicité complète (points + stock + redemption)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_account_id uuid,
  p_reward_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reward public.loyalty_rewards%ROWTYPE;
  v_points public.loyalty_points%ROWTYPE;
  v_account public.accounts%ROWTYPE;
  v_redemption_id uuid;
  v_new_balance integer;
  v_existing uuid;
  v_is_admin boolean;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'idempotency_key_required');
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin');

  -- Ownership + état compte
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_not_found');
  END IF;
  IF NOT v_is_admin AND v_account.client_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF COALESCE(v_account.status::text,'') IN ('suspended','cancelled','fraud','frozen') THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_not_eligible');
  END IF;

  -- Idempotence: si clé déjà utilisée, renvoyer la rédemption existante
  SELECT id INTO v_existing
  FROM public.loyalty_redemptions
  WHERE account_id = p_account_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT available_points INTO v_new_balance FROM public.loyalty_points WHERE account_id = p_account_id;
    RETURN jsonb_build_object('success', true, 'redemption_id', v_existing, 'new_balance', v_new_balance, 'idempotent', true);
  END IF;

  -- Verrouillage stock reward
  SELECT * INTO v_reward
  FROM public.loyalty_rewards
  WHERE id = p_reward_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'reward_not_found');
  END IF;
  IF v_reward.stock_limit IS NOT NULL AND v_reward.redemptions_count >= v_reward.stock_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_stock');
  END IF;

  -- Verrouillage points
  SELECT * INTO v_points
  FROM public.loyalty_points
  WHERE account_id = p_account_id
  FOR UPDATE;
  IF NOT FOUND OR v_points.available_points < v_reward.points_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_points');
  END IF;

  -- Débit atomique
  UPDATE public.loyalty_points
     SET available_points = available_points - v_reward.points_required,
         updated_at = now()
   WHERE account_id = p_account_id
  RETURNING available_points INTO v_new_balance;

  INSERT INTO public.loyalty_redemptions(account_id, reward_id, points_spent, status, idempotency_key)
  VALUES (p_account_id, p_reward_id, v_reward.points_required, 'pending', p_idempotency_key)
  RETURNING id INTO v_redemption_id;

  UPDATE public.loyalty_rewards
     SET redemptions_count = redemptions_count + 1
   WHERE id = p_reward_id;

  INSERT INTO public.loyalty_transactions(account_id, type, points, description, reference_id, reference_type, balance_after)
  VALUES (p_account_id, 'redeemed', -v_reward.points_required,
          'Échange: ' || v_reward.name_fr, v_redemption_id, 'loyalty_redemption', v_new_balance);

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id, 'new_balance', v_new_balance);
END;
$$;

-- F32-12: Décision admin sur redemption avec refund automatique si rejet
CREATE OR REPLACE FUNCTION public.admin_loyalty_redemption_decide(
  p_redemption_id uuid,
  p_decision text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := public._require_admin();
  _red public.loyalty_redemptions%ROWTYPE;
  _lp public.loyalty_points%ROWTYPE;
  _refund_tx uuid;
  _new_balance integer;
BEGIN
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'decision must be approve|reject'; END IF;
  IF coalesce(length(trim(p_reason)),0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _red FROM public.loyalty_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'redemption not found'; END IF;
  IF _red.status <> 'pending' THEN RAISE EXCEPTION 'redemption not pending (status=%)', _red.status; END IF;

  IF p_decision = 'approve' THEN
    UPDATE public.loyalty_redemptions
       SET status = 'approved', applied_at = now()
     WHERE id = p_redemption_id;
  ELSE
    -- Refund complet des points
    SELECT * INTO _lp FROM public.loyalty_points WHERE account_id = _red.account_id FOR UPDATE;
    UPDATE public.loyalty_points
       SET available_points = available_points + _red.points_spent,
           updated_at = now()
     WHERE account_id = _red.account_id
    RETURNING available_points INTO _new_balance;

    INSERT INTO public.loyalty_transactions(account_id, type, points, description, reference_id, reference_type, balance_after, status, reviewed_by, reviewed_at, admin_reason)
    VALUES (_red.account_id, 'adjusted', _red.points_spent,
            'Refund rédemption rejetée', _red.id, 'loyalty_redemption_refund',
            _new_balance, 'posted', _actor, now(), p_reason)
    RETURNING id INTO _refund_tx;

    UPDATE public.loyalty_rewards SET redemptions_count = GREATEST(redemptions_count - 1, 0) WHERE id = _red.reward_id;

    UPDATE public.loyalty_redemptions
       SET status = 'rejected', refunded_at = now(), refund_tx_id = _refund_tx
     WHERE id = p_redemption_id;
  END IF;

  PERFORM public._admin_log_loyalty_or_ref(_actor,
    CASE WHEN p_decision='approve' THEN 'loyalty.redemption.approve' ELSE 'loyalty.redemption.reject' END,
    'loyalty_redemption', p_redemption_id, _red.account_id, p_reason,
    jsonb_build_object('status','pending','points_spent', _red.points_spent),
    jsonb_build_object('status', CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,
                       'refund_tx', _refund_tx));

  RETURN jsonb_build_object('ok', true, 'decision', p_decision, 'refund_tx', _refund_tx);
END;
$$;

-- F32-10: Recalcul tier automatique sur mise à jour lifetime_points
CREATE OR REPLACE FUNCTION public.fn_loyalty_recalc_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lifetime_points IS DISTINCT FROM OLD.lifetime_points THEN
    NEW.tier := CASE
      WHEN NEW.lifetime_points >= 5000 THEN 'platinum'
      WHEN NEW.lifetime_points >= 1500 THEN 'gold'
      WHEN NEW.lifetime_points >=  500 THEN 'silver'
      ELSE 'bronze'
    END;
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
      NEW.tier_updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_recalc_tier ON public.loyalty_points;
CREATE TRIGGER trg_loyalty_recalc_tier
BEFORE UPDATE ON public.loyalty_points
FOR EACH ROW EXECUTE FUNCTION public.fn_loyalty_recalc_tier();

-- F32-11: Expiration transaction-par-transaction (stratégie: expiration par tx via expires_at)
CREATE OR REPLACE FUNCTION public.expire_loyalty_points()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx RECORD;
  _lp public.loyalty_points%ROWTYPE;
  _new_balance integer;
  _count int := 0;
BEGIN
  FOR _tx IN
    SELECT t.id, t.account_id, t.points, t.description
    FROM public.loyalty_transactions t
    WHERE t.expires_at IS NOT NULL
      AND t.expires_at <= now()
      AND t.status = 'posted'
      AND t.points > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_transactions x
        WHERE x.reference_id = t.id
          AND x.reference_type = 'loyalty_expiration'
      )
  LOOP
    SELECT * INTO _lp FROM public.loyalty_points WHERE account_id = _tx.account_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.loyalty_points
       SET available_points = GREATEST(available_points - _tx.points, 0),
           updated_at = now()
     WHERE account_id = _tx.account_id
    RETURNING available_points INTO _new_balance;

    INSERT INTO public.loyalty_transactions(account_id, type, points, description, reference_id, reference_type, balance_after, status)
    VALUES (_tx.account_id, 'expired', -_tx.points,
            'Expiration automatique: ' || COALESCE(_tx.description,''),
            _tx.id, 'loyalty_expiration', _new_balance, 'posted');

    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expired_count', _count);
END;
$$;

-- F32-6: Renforcer admin_loyalty_transfer avec vérif éligibilité comptes
CREATE OR REPLACE FUNCTION public.admin_loyalty_transfer(p_from_account uuid, p_to_account uuid, p_points integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := public._require_admin();
  _from public.loyalty_points%ROWTYPE;
  _to public.loyalty_points%ROWTYPE;
  _from_acc public.accounts%ROWTYPE;
  _to_acc public.accounts%ROWTYPE;
  _tx_out uuid; _tx_in uuid;
BEGIN
  IF p_from_account = p_to_account THEN RAISE EXCEPTION 'from = to'; END IF;
  IF p_points <= 0 THEN RAISE EXCEPTION 'points must be > 0'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'reason must be >= 5 chars'; END IF;

  SELECT * INTO _from_acc FROM public.accounts WHERE id = p_from_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'source account not found'; END IF;
  SELECT * INTO _to_acc FROM public.accounts WHERE id = p_to_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'destination account not found'; END IF;

  IF COALESCE(_from_acc.status::text,'') IN ('suspended','cancelled','fraud','frozen') THEN
    RAISE EXCEPTION 'source account not eligible (status=%)', _from_acc.status;
  END IF;
  IF COALESCE(_to_acc.status::text,'') IN ('suspended','cancelled','fraud','frozen') THEN
    RAISE EXCEPTION 'destination account not eligible (status=%)', _to_acc.status;
  END IF;

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
END$function$;

-- Grants pour appels autorisés
REVOKE ALL ON FUNCTION public.redeem_loyalty_reward(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_loyalty_redemption_decide(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_redemption_decide(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expire_loyalty_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_loyalty_points() TO service_role;
