-- F33-6
DROP TRIGGER IF EXISTS trg_track_referral_payment ON public.billing_subscriptions;
DROP FUNCTION IF EXISTS public.fn_track_referral_payment() CASCADE;

-- F33-7 defaults + backfill
ALTER TABLE public.client_referrals ALTER COLUMN required_cycles SET DEFAULT 2;

UPDATE public.client_referrals cr
   SET required_cycles = COALESCE(
         (SELECT required_cycles FROM public.referral_program_settings LIMIT 1), 2)
 WHERE cr.status NOT IN ('qualified','reward_pending','reward_issued','cancelled','disqualified');

-- F33-7 fn_check_referral_qualification
CREATE OR REPLACE FUNCTION public.fn_check_referral_qualification(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_ref RECORD;
  v_paid_count INT;
  v_required INT;
  v_sub_status TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.client_referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_ref.status IN ('qualified','reward_pending','reward_issued','cancelled','disqualified') THEN
    RETURN;
  END IF;

  SELECT COALESCE(required_cycles, 2) INTO v_required
    FROM public.referral_program_settings LIMIT 1;
  v_required := COALESCE(v_required, v_ref.required_cycles, 2);

  IF v_ref.referred_subscription_id IS NOT NULL THEN
    SELECT status INTO v_sub_status FROM public.subscriptions
      WHERE id = v_ref.referred_subscription_id;
    IF v_sub_status IN ('cancelled','expired') THEN
      UPDATE public.client_referrals
        SET status='cancelled', reward_status='cancelled',
            disqualified_at=now(),
            disqualification_reason='Abonnement annulé/expiré',
            updated_at=now()
        WHERE id = p_referral_id;
      INSERT INTO public.client_referral_events (referral_id,event_type,new_status,details)
        VALUES (p_referral_id,'status_change','cancelled',
                jsonb_build_object('reason','Subscription cancelled/expired'));
      RETURN;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_paid_count
    FROM public.billing_invoices bi
   WHERE bi.subscription_id = v_ref.referred_subscription_id
     AND bi.type = 'renewal'
     AND bi.status = 'paid';

  UPDATE public.client_referrals
    SET qualifying_cycles_paid = v_paid_count,
        required_cycles = v_required,
        status = CASE
          WHEN v_paid_count >= v_required THEN 'qualified'::referral_status
          WHEN v_paid_count = 2 THEN 'cycle_2_paid'::referral_status
          WHEN v_paid_count = 1 THEN 'cycle_1_paid'::referral_status
          ELSE status
        END,
        reward_status = CASE
          WHEN v_paid_count >= v_required THEN 'reward_pending'::referral_reward_status
          WHEN v_paid_count >= 1 THEN 'in_progress'::referral_reward_status
          ELSE reward_status
        END,
        qualified_at = CASE
          WHEN v_paid_count >= v_required AND qualified_at IS NULL THEN now()
          ELSE qualified_at
        END,
        updated_at = now()
    WHERE id = p_referral_id;

  IF v_paid_count >= 1 THEN
    INSERT INTO public.client_referral_events (referral_id,event_type,new_status,details)
      VALUES (p_referral_id,'qualification_progress',
              CASE WHEN v_paid_count >= v_required THEN 'qualified'
                   WHEN v_paid_count = 2 THEN 'cycle_2_paid'
                   ELSE 'cycle_1_paid' END,
              jsonb_build_object('paid_cycles',v_paid_count,'required_cycles',v_required));
  END IF;
END;
$function$;

-- F33-9 rpc_referral_apply_action (drop then recreate — signature change safe)
DROP FUNCTION IF EXISTS public.rpc_referral_apply_action(uuid,text,uuid,text,jsonb,text);

CREATE OR REPLACE FUNCTION public.rpc_referral_apply_action(
  p_referral_id uuid,
  p_action text,
  p_actor_id uuid,
  p_reason text,
  p_payload jsonb,
  p_event_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref RECORD;
  v_existing UUID;
  v_valid TEXT[] := ARRAY['qualify','issue_reward','mark_delivered',
                          'mark_fraud','clear_fraud','disqualify','clawback','reassign'];
BEGIN
  IF NOT (p_action = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Action invalide: %', p_action;
  END IF;

  IF p_action IN ('mark_fraud','disqualify','clawback','reassign')
     AND COALESCE(TRIM(p_reason),'') = '' THEN
    RAISE EXCEPTION 'Raison requise pour action %', p_action;
  END IF;

  SELECT * INTO v_ref FROM public.client_referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parrainage introuvable: %', p_referral_id;
  END IF;

  IF p_event_key IS NOT NULL AND p_event_key <> '' THEN
    SELECT id INTO v_existing FROM public.client_referral_events
      WHERE referral_id = p_referral_id
        AND details->>'event_key' = p_event_key
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;
  END IF;

  -- F33-9 — délégation à la machine d'état canonique
  IF p_action = 'qualify' THEN
    PERFORM public.fn_check_referral_qualification(p_referral_id);
  END IF;

  INSERT INTO public.client_referral_events
    (referral_id, event_type, old_status, new_status, details, actor_type)
  VALUES (
    p_referral_id,
    CASE p_action
      WHEN 'qualify' THEN 'qualified'
      WHEN 'issue_reward' THEN 'reward_issued'
      WHEN 'mark_delivered' THEN 'reward_delivered'
      WHEN 'mark_fraud' THEN 'fraud_flagged'
      WHEN 'clear_fraud' THEN 'fraud_cleared'
      WHEN 'disqualify' THEN 'disqualified'
      WHEN 'clawback' THEN 'clawback'
      WHEN 'reassign' THEN 'reassigned'
    END,
    v_ref.status::text,
    NULL,
    jsonb_build_object('event_key',p_event_key,'actor_id',p_actor_id,
                       'reason',p_reason,'payload',p_payload),
    'admin'
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false);
END;
$function$;

-- F33-10 / F33-23 apply_referral_discount durci
DROP FUNCTION IF EXISTS public.apply_referral_discount(uuid, numeric);
DROP FUNCTION IF EXISTS public.apply_referral_discount(uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.apply_referral_discount(
  p_account_id uuid,
  p_invoice_amount numeric,
  p_invoice_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount NUMERIC := 0;
  v_sub RECORD;
  v_invoice RECORD;
  v_max NUMERIC;
  v_month_index INT;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN 0; END IF;

  SELECT id, type, status, subscription_id, cancelled_at
    INTO v_invoice
    FROM public.billing_invoices
    WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- F33-10 renewal + paid + non annulée
  IF v_invoice.type <> 'renewal' THEN RETURN 0; END IF;
  IF v_invoice.status <> 'paid'  THEN RETURN 0; END IF;
  IF v_invoice.cancelled_at IS NOT NULL THEN RETURN 0; END IF;

  SELECT bs.* INTO v_sub
    FROM public.billing_subscriptions bs
   WHERE bs.id = v_invoice.subscription_id
     AND bs.referral_discount_active = true
     AND bs.referral_discount_months_remaining > 0
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_max := COALESCE(v_sub.referral_discount_amount, 0);
  v_discount := LEAST(v_max, p_invoice_amount);
  IF v_discount <= 0 THEN RETURN 0; END IF;

  v_month_index := 10 - v_sub.referral_discount_months_remaining + 1;

  UPDATE public.billing_subscriptions
     SET referral_discount_months_remaining = GREATEST(referral_discount_months_remaining - 1, 0),
         referral_discount_active = (referral_discount_months_remaining - 1) > 0
   WHERE id = v_sub.id;

  INSERT INTO public.billing_invoice_lines (
    invoice_id, line_type, description, quantity, unit_price, line_total, metadata
  ) VALUES (
    p_invoice_id, 'discount',
    'Rabais référence — mois ' || v_month_index || '/10',
    1, -v_discount, -v_discount,
    jsonb_build_object('kind','referral_discount',
                       'subscription_id', v_sub.id,
                       'month_index', v_month_index)
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.client_referral_events (referral_id, event_type, details)
  SELECT cr.id, 'discount_applied',
         jsonb_build_object('invoice_id', p_invoice_id,
                            'amount', v_discount,
                            'month_index', v_month_index)
    FROM public.client_referrals cr
   WHERE cr.referred_account_id = p_account_id
     AND cr.status IS DISTINCT FROM 'disqualified'::referral_status
   LIMIT 1;

  RETURN v_discount;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_lines_one_referral_discount
  ON public.billing_invoice_lines (invoice_id)
  WHERE line_type = 'discount' AND (metadata->>'kind') = 'referral_discount';
