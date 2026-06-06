-- ============================================================
-- 1. Resolve stale paypal_create_order_missing_reference alerts
--    (AddAccountCredit and ClientNewOrder now pass credit_topup flag)
-- ============================================================
UPDATE billing_system_alerts
SET resolved = true, resolved_at = now()
WHERE alert_type = 'paypal_create_order_missing_reference'
  AND resolved = false;

-- ============================================================
-- 2. Backfill next_invoice_date on accounts where it is NULL
--    Uses billing_cycle_day to compute next occurrence after today.
-- ============================================================
UPDATE accounts
SET next_invoice_date = (
  CASE
    WHEN make_date(
           extract(year  from current_date)::int,
           extract(month from current_date)::int,
           LEAST(billing_cycle_day, 28)
         ) > current_date
    THEN make_date(
           extract(year  from current_date)::int,
           extract(month from current_date)::int,
           LEAST(billing_cycle_day, 28)
         )
    ELSE make_date(
           extract(year  from (current_date + interval '1 month'))::int,
           extract(month from (current_date + interval '1 month'))::int,
           LEAST(billing_cycle_day, 28)
         )
  END
)
WHERE status = 'active'
  AND billing_cycle_day IS NOT NULL
  AND next_invoice_date IS NULL;

-- ============================================================
-- 3. Fix NO_ACTIVE_SUBSCRIPTIONS for accounts 659071 and 781652
--    These accounts have billing_subscriptions in "pending" state
--    but generate_account_renewal_invoice looks for status='active'.
--    Activate any pending subscription tied to an active order.
-- ============================================================
UPDATE billing_subscriptions bs
SET status = 'active', updated_at = now()
FROM accounts a
WHERE a.account_number IN ('659071', '781652')
  AND bs.order_id IN (
    SELECT id FROM orders WHERE account_id = a.id AND status NOT IN ('cancelled', 'refunded')
  )
  AND bs.status = 'pending';

-- ============================================================
-- 4. If still no billing_subscriptions, create them from subscriptions table
-- ============================================================
DO $$
DECLARE
  v_acct record;
  v_sub  record;
  v_cust_id uuid;
BEGIN
  FOR v_acct IN
    SELECT a.*
    FROM accounts a
    WHERE a.account_number IN ('659071', '781652')
      AND NOT EXISTS (
        SELECT 1 FROM billing_subscriptions bs
        WHERE bs.order_id IN (SELECT id FROM orders WHERE account_id = a.id)
          AND bs.status = 'active'
      )
  LOOP
    RAISE NOTICE '[sub-fix] Account % (id=%) has no active billing_subscriptions', v_acct.account_number, v_acct.id;

    -- Find the most recent active subscription in the legacy subscriptions table
    SELECT s.* INTO v_sub
    FROM subscriptions s
    WHERE s.user_id = v_acct.client_id
      AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_sub IS NULL THEN
      RAISE NOTICE '[sub-fix]   No active subscription in subscriptions table for account %', v_acct.account_number;
      -- Mark alerts as needing manual review
      UPDATE billing_system_alerts
      SET details = details || jsonb_build_object(
            'manual_review_needed', true,
            'reason', 'No active subscription found in either billing_subscriptions or subscriptions table',
            'checked_at', now()
          )
      WHERE alert_type = 'renewal_terminal_error'
        AND entity_reference = v_acct.account_number
        AND resolved = false;
      CONTINUE;
    END IF;

    RAISE NOTICE '[sub-fix]   Found legacy subscription id=%, plan=%, price=%', v_sub.id, v_sub.plan_name, v_sub.monthly_price;

    -- Find billing_customer
    SELECT bc.id INTO v_cust_id
    FROM billing_customers bc
    JOIN auth.users au ON lower(au.email) = lower(bc.email)
    WHERE au.id = v_acct.client_id
    LIMIT 1;

    -- Create billing_subscription
    INSERT INTO billing_subscriptions (
      customer_id,
      order_id,
      plan_code,
      plan_name,
      plan_price,
      status,
      cycle_start_date,
      cycle_end_date,
      service_category,
      auto_billing_enabled,
      environment
    )
    SELECT
      v_cust_id,
      o.id,
      COALESCE(v_sub.plan_code, v_sub.plan_name, 'UNKNOWN'),
      COALESCE(v_sub.plan_name, 'Service'),
      COALESCE(v_sub.monthly_price, 0),
      'active',
      current_date,
      (current_date + interval '1 month')::date,
      'mobile',
      false,
      'live'
    FROM orders o
    WHERE o.account_id = v_acct.id
      AND o.status NOT IN ('cancelled', 'refunded')
    ORDER BY o.created_at DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '[sub-fix]   Created billing_subscription for account %', v_acct.account_number;
  END LOOP;
END $$;

-- ============================================================
-- 5. Retry generate_account_renewal_invoice for the fixed accounts
-- ============================================================
DO $$
DECLARE
  v_acct record;
  v_result jsonb;
BEGIN
  FOR v_acct IN
    SELECT a.*
    FROM accounts a
    WHERE a.account_number IN ('659071', '781652')
  LOOP
    BEGIN
      SELECT public.generate_account_renewal_invoice(v_acct.id) INTO v_result;
      RAISE NOTICE '[renewal-retry] Account % result: %', v_acct.account_number, v_result;

      IF COALESCE((v_result->>'success')::boolean, false)
         OR v_result->>'error' = 'RENEWAL_ALREADY_EXISTS' THEN
        UPDATE billing_system_alerts
        SET resolved = true, resolved_at = now()
        WHERE alert_type = 'renewal_terminal_error'
          AND entity_reference = v_acct.account_number
          AND resolved = false;
        RAISE NOTICE '[renewal-retry]   Alerts resolved for account %', v_acct.account_number;
      ELSE
        UPDATE billing_system_alerts
        SET details = details || jsonb_build_object(
              'retry2_at', now(),
              'retry2_result', v_result
            )
        WHERE alert_type = 'renewal_terminal_error'
          AND entity_reference = v_acct.account_number
          AND resolved = false;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[renewal-retry]   EXCEPTION for account %: %', v_acct.account_number, SQLERRM;
      UPDATE billing_system_alerts
      SET details = details || jsonb_build_object('retry2_exception', SQLERRM, 'retry2_at', now())
      WHERE alert_type = 'renewal_terminal_error'
        AND entity_reference = v_acct.account_number
        AND resolved = false;
    END;
  END LOOP;
END $$;
