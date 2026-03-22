-- ============================================================
-- FIX 1: update_subscription_on_invoice_paid
-- BUG: Overwrites cycle_start/end with paid_at on ALL invoices
--       including renewals, destroying the canonical billing_cycle_day anchor.
-- FIX: Only recalculate cycle dates for INITIAL invoices (type != 'renewal').
-- ============================================================

CREATE OR REPLACE FUNCTION update_subscription_on_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  payment_confirmed_at TIMESTAMPTZ;
  new_cycle_start DATE;
  new_cycle_end DATE;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'paid' THEN
    
    -- For RENEWAL invoices: DO NOT overwrite cycle dates.
    -- The RPC already set them correctly anchored to billing_cycle_day.
    IF NEW.type = 'renewal' THEN
      UPDATE billing_subscriptions
      SET 
        status = 'active',
        cycle_start_date = NEW.cycle_start_date,
        cycle_end_date = NEW.cycle_end_date,
        last_invoice_id = NEW.id,
        updated_at = NOW()
      WHERE id = NEW.subscription_id;
      
      RAISE NOTICE '[billing-trigger] Renewal invoice % paid. Subscription % reactivated with existing cycle % to %',
        NEW.invoice_number, NEW.subscription_id, NEW.cycle_start_date, NEW.cycle_end_date;
      
      RETURN NEW;
    END IF;
    
    -- For INITIAL invoices: calculate cycle from payment date
    payment_confirmed_at := COALESCE(NEW.paid_at, NOW());
    new_cycle_start := payment_confirmed_at::DATE;
    new_cycle_end := (payment_confirmed_at + INTERVAL '30 days')::DATE;
    
    NEW.cycle_start_date := new_cycle_start;
    NEW.cycle_end_date := new_cycle_end;
    
    UPDATE billing_subscriptions
    SET 
      status = 'active',
      cycle_start_date = new_cycle_start,
      cycle_end_date = new_cycle_end,
      last_invoice_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.subscription_id;
    
    RAISE NOTICE '[billing-trigger] Initial invoice % paid at %. Subscription % activated with cycle % to %',
      NEW.invoice_number, payment_confirmed_at, NEW.subscription_id, new_cycle_start, new_cycle_end;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIX 2: enforce_invoice_invariants
-- BUG: Resets 'overdue' status back to 'pending', blocking J+5 window.
-- FIX: Allow 'overdue' as a valid lifecycle status.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_invoice_invariants()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_paid := COALESCE(NEW.amount_paid, 0);
  NEW.balance_due := GREATEST(NEW.total - NEW.amount_paid, 0);

  IF NEW.status = 'paid' THEN
    IF NEW.amount_paid < NEW.total THEN
      NEW.status := 'pending'::billing_invoice_status;
      NEW.paid_at := NULL;
      
      INSERT INTO billing_system_alerts (entity_type, entity_id, alert_type, details)
      VALUES ('invoice', NEW.id, 'invariant_violation',
        jsonb_build_object(
          'rule', 'paid_without_sufficient_payment',
          'invoice_number', NEW.invoice_number,
          'total', NEW.total,
          'amount_paid', NEW.amount_paid
        )
      );
    ELSE
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := NOW();
      END IF;
      NEW.balance_due := 0;
    END IF;
  END IF;

  IF NEW.balance_due > 0 AND NEW.status = 'paid' THEN
    NEW.status := 'pending'::billing_invoice_status;
    NEW.paid_at := NULL;
  END IF;

  -- 'overdue' is a valid lifecycle state set by billing-lifecycle-daily
  -- at J+5. Do NOT reset it. The J+5 to J+10 reactivation window depends on it.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;