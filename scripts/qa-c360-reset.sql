-- QA C360 — Reset script for the isolated test account.
-- Safe to run before each new validation pass.
-- Reverts the subscription to Internet 500 Mbps @ 50$, clears audit noise
-- generated during the previous run, but keeps the account/profile/address/equipment
-- so IDs stay stable across passes.
--
-- USAGE (psql):
--   \set ON_ERROR_STOP on
--   \i scripts/qa-c360-reset.sql
--
-- Guardrails:
--   - Only touches rows tied to tag_key='qa_test_account'
--   - Never touches environment='live' subscriptions

DO $$
DECLARE
  v_user_id uuid;
  v_account_id uuid;
  v_subscription_id uuid;
  v_anchor_day int;
BEGIN
  SELECT client_user_id, account_id
    INTO v_user_id, v_account_id
  FROM public.account_tags
  WHERE tag_key = 'qa_test_account'
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE NOTICE 'QA C360 account not provisioned yet. Invoke qa-provision-test-account first.';
    RETURN;
  END IF;

  SELECT id INTO v_subscription_id
  FROM public.billing_subscriptions
  WHERE customer_id = v_user_id
    AND environment = 'test'
  LIMIT 1;

  v_anchor_day := LEAST(GREATEST(EXTRACT(day FROM now())::int, 1), 28);

  -- Reset subscription to Internet 500 Mbps @ 50$
  UPDATE public.billing_subscriptions
     SET plan_code           = 'internet_500',
         plan_name           = 'Internet 500 Mbps',
         plan_price          = 50.00,
         status              = 'active',
         cycle_start_date    = CURRENT_DATE,
         cycle_end_date      = (CURRENT_DATE + INTERVAL '1 month')::date - 1,
         billing_anchor_date = CURRENT_DATE,
         billing_cycle_anchor= v_anchor_day,
         auto_billing_enabled= false,
         updated_at          = now()
   WHERE id = v_subscription_id
     AND environment = 'test';

  -- Clear noise from prior passes
  DELETE FROM public.service_change_requests
   WHERE client_user_id = v_user_id;

  DELETE FROM public.admin_audit_log
   WHERE target_type IN ('billing_subscription', 'account')
     AND (target_id::text = v_subscription_id::text OR target_id::text = v_account_id::text);

  DELETE FROM public.activity_logs
   WHERE user_id = v_user_id;

  DELETE FROM public.email_queue
   WHERE recipient_email ILIKE '%@nivra-test.ca';

  DELETE FROM public.billing_invoice_lines
   WHERE invoice_id IN (
     SELECT id FROM public.billing_invoices WHERE customer_id = v_user_id
   );

  DELETE FROM public.billing_invoices
   WHERE customer_id = v_user_id;

  RAISE NOTICE 'QA C360 test account reset. subscription_id=%, account_id=%, user_id=%',
    v_subscription_id, v_account_id, v_user_id;
END $$;
