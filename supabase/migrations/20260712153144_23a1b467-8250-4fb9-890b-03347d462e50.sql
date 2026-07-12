
-- =========================================================================
-- MODULE 54.2 Phase 6.2 — 3 canonical RPCs + allowlist registration
-- =========================================================================

-- 1) rpc_client_request_subscription_pause -------------------------------
CREATE OR REPLACE FUNCTION public.rpc_client_request_subscription_pause(
  p_subscription_id uuid,
  p_reason text,
  p_pause_duration_days integer,
  p_requested_for date,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_customer record;
  v_account_id uuid;
  v_request_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_subscription_id IS NULL THEN
    RAISE EXCEPTION 'subscription_id requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_pause_duration_days IS NULL OR p_pause_duration_days < 1 OR p_pause_duration_days > 90 THEN
    RAISE EXCEPTION 'pause_duration_days must be 1..90' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT s.id, s.customer_id, s.status, s.plan_name
    INTO v_sub
    FROM public.billing_subscriptions s
   WHERE s.id = p_subscription_id;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  -- Ownership check: subscription -> billing_customer -> user_id
  SELECT bc.user_id INTO v_customer
    FROM public.billing_customers bc
   WHERE bc.id = v_sub.customer_id;
  IF v_customer.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_OWNER' USING ERRCODE = '42501';
  END IF;

  IF v_sub.status::text NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'INVALID_STATE_FOR_PAUSE_REQUEST: current=%', v_sub.status USING ERRCODE = '22023';
  END IF;

  SELECT a.id INTO v_account_id
    FROM public.accounts a
   WHERE a.client_id = v_uid
   ORDER BY a.created_at DESC LIMIT 1;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.suspension_requests (
    account_id, client_id, subscription_id, reason,
    requested_for, pause_duration_days, requested_by, status, notes
  ) VALUES (
    v_account_id, v_uid, p_subscription_id, COALESCE(p_reason,'client_request'),
    p_requested_for, p_pause_duration_days, v_uid, 'pending',
    COALESCE(p_notes, 'Client self-serve pause request via portal.')
  ) RETURNING id INTO v_request_id;

  UPDATE public.billing_subscriptions
     SET status = 'pause_requested'::billing_subscription_status,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.billing_subscription_trace_audit (
    subscription_id, customer_id, action, reason, details
  ) VALUES (
    p_subscription_id, v_sub.customer_id,
    'client_pause_requested',
    p_reason,
    jsonb_build_object(
      'previous_status', v_sub.status,
      'new_status', 'pause_requested',
      'suspension_request_id', v_request_id,
      'pause_duration_days', p_pause_duration_days,
      'requested_for', p_requested_for
    )
  );

  RETURN v_request_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_client_request_subscription_pause(uuid,text,integer,date,text)
  TO authenticated, service_role;


-- 2) rpc_apply_referral_discount -----------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_apply_referral_discount(
  p_customer_id uuid,
  p_order_id uuid,
  p_code text,
  p_amount numeric,
  p_months_remaining integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_updated integer;
BEGIN
  IF p_customer_id IS NULL OR p_order_id IS NULL OR COALESCE(p_code,'') = '' THEN
    RAISE EXCEPTION 'customer_id, order_id, code requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'amount invalide' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_months_remaining IS NULL OR p_months_remaining < 0 THEN
    RAISE EXCEPTION 'months_remaining invalide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- STRICT COLUMN SCOPE: referral_* only. No status/plan/price/cycle/client_id.
  UPDATE public.billing_subscriptions
     SET referral_discount_active = true,
         referral_discount_amount = ROUND(p_amount, 2),
         referral_discount_months_remaining = p_months_remaining,
         referral_code_used = p_code,
         updated_at = now()
   WHERE customer_id = p_customer_id
     AND order_id = p_order_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_referral_discount(uuid,uuid,text,numeric,integer)
  TO service_role;


-- 3) rpc_mark_subscription_not_renewed -----------------------------------
CREATE OR REPLACE FUNCTION public.rpc_mark_subscription_not_renewed(
  p_subscription_id uuid,
  p_reason text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_sub record;
BEGIN
  IF p_subscription_id IS NULL THEN
    RAISE EXCEPTION 'subscription_id requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT id, customer_id, status
    INTO v_sub
    FROM public.billing_subscriptions
   WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_sub.status::text NOT IN ('active','suspended') THEN
    -- Idempotent: already terminal
    RETURN false;
  END IF;

  UPDATE public.billing_subscriptions
     SET status = 'not_renewed'::billing_subscription_status,
         auto_billing_enabled = false,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.billing_subscription_trace_audit (
    subscription_id, customer_id, action, reason, details
  ) VALUES (
    p_subscription_id, v_sub.customer_id,
    'marked_not_renewed',
    COALESCE(p_reason,'prepaid_grace_period_expired'),
    jsonb_build_object(
      'previous_status', v_sub.status,
      'new_status', 'not_renewed',
      'context', p_context
    )
  );

  RETURN true;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_mark_subscription_not_renewed(uuid,text,jsonb)
  TO service_role;


-- 4) Register in writer allowlist ----------------------------------------
INSERT INTO public.billing_subscription_writer_allowlist
  (function_name, allowed_operations, category, active, notes)
VALUES
  ('rpc_client_request_subscription_pause', ARRAY['UPDATE'], 'state_machine', true,
   'Phase 6.2 — client self-serve pause request. Ownership-checked via auth.uid().'),
  ('rpc_apply_referral_discount', ARRAY['UPDATE'], 'automation', true,
   'Phase 6.2 — referral columns only (referral_discount_active/amount/months_remaining/code_used).'),
  ('rpc_mark_subscription_not_renewed', ARRAY['UPDATE'], 'automation', true,
   'Phase 6.2 — prepaid grace-period expiry (agent-billing).')
ON CONFLICT (function_name) DO UPDATE
  SET allowed_operations = EXCLUDED.allowed_operations,
      category = EXCLUDED.category,
      active = true,
      notes = EXCLUDED.notes,
      updated_at = now();
