-- ============================================================
-- Fix: renewal_terminal_error for accounts 659071 and 781652
-- 1. Diagnose data issues (NULL billing_cycle_day / next_invoice_date)
-- 2. Patch missing data
-- 3. Retry generate_account_renewal_invoice
-- 4. Resolve the alerts on success
-- ============================================================

DO $$
DECLARE
  v_acct        record;
  v_result      jsonb;
  v_fix_applied boolean;
BEGIN
  FOR v_acct IN
    SELECT a.*
    FROM accounts a
    WHERE a.account_number IN ('659071', '781652')
  LOOP
    v_fix_applied := false;

    RAISE NOTICE '[renewal-fix] Processing account % (id=%)', v_acct.account_number, v_acct.id;
    RAISE NOTICE '[renewal-fix]   status=%, billing_cycle_day=%, next_invoice_date=%',
      v_acct.status, v_acct.billing_cycle_day, v_acct.next_invoice_date;

    -- Fix 1: NULL billing_cycle_day → default to 1
    IF v_acct.billing_cycle_day IS NULL THEN
      UPDATE accounts SET billing_cycle_day = 1, updated_at = now() WHERE id = v_acct.id;
      RAISE NOTICE '[renewal-fix]   Fixed: billing_cycle_day set to 1';
      v_fix_applied := true;
    END IF;

    -- Fix 2: NULL next_invoice_date → set to billing_cycle_day in current/next month
    IF v_acct.next_invoice_date IS NULL THEN
      UPDATE accounts
      SET next_invoice_date = make_date(
            extract(year  from current_date)::int,
            extract(month from current_date)::int,
            COALESCE(v_acct.billing_cycle_day, 1)
          ),
          updated_at = now()
      WHERE id = v_acct.id;
      RAISE NOTICE '[renewal-fix]   Fixed: next_invoice_date set';
      v_fix_applied := true;
    END IF;

    -- Reload account with fixes applied
    SELECT * INTO v_acct FROM accounts WHERE id = v_acct.id;

    -- Retry invoice generation (idempotent — safe to call even if invoice exists)
    BEGIN
      SELECT public.generate_account_renewal_invoice(v_acct.id) INTO v_result;
      RAISE NOTICE '[renewal-fix]   generate_account_renewal_invoice result: %', v_result;

      IF COALESCE((v_result->>'success')::boolean, false) THEN
        -- Mark alerts resolved
        UPDATE billing_system_alerts
        SET resolved = true, resolved_at = now()
        WHERE alert_type = 'renewal_terminal_error'
          AND entity_reference = v_acct.account_number
          AND resolved = false;
        RAISE NOTICE '[renewal-fix]   SUCCESS — alerts resolved for account %', v_acct.account_number;
      ELSE
        RAISE NOTICE '[renewal-fix]   generate returned error: % (already exists or other cause)',
          v_result->>'error';
        -- RENEWAL_ALREADY_EXISTS is OK — means invoice was already created
        IF v_result->>'error' = 'RENEWAL_ALREADY_EXISTS' THEN
          UPDATE billing_system_alerts
          SET resolved = true, resolved_at = now()
          WHERE alert_type = 'renewal_terminal_error'
            AND entity_reference = v_acct.account_number
            AND resolved = false;
          RAISE NOTICE '[renewal-fix]   RENEWAL_ALREADY_EXISTS — alerts resolved for account %', v_acct.account_number;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log the real exception into the alert details for visibility
      RAISE NOTICE '[renewal-fix]   EXCEPTION for account %: %', v_acct.account_number, SQLERRM;
      UPDATE billing_system_alerts
      SET details = details || jsonb_build_object(
            'fix_attempt_at', now(),
            'fix_exception', SQLERRM,
            'billing_cycle_day', v_acct.billing_cycle_day,
            'next_invoice_date', v_acct.next_invoice_date,
            'account_status', v_acct.status
          )
      WHERE alert_type = 'renewal_terminal_error'
        AND entity_reference = v_acct.account_number
        AND resolved = false;
    END;
  END LOOP;
END $$;
