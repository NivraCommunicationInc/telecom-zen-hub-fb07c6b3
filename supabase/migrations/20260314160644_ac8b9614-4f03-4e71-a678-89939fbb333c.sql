
-- ═══════════════════════════════════════════════════════════════
-- HARDENING MIGRATION: Transaction Chain Integrity Protection
-- ═══════════════════════════════════════════════════════════════

-- 1. UNIQUE partial index on accounts(client_id) for active accounts only
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_active_client 
ON accounts(client_id) 
WHERE status = 'active';

-- 2. Trigger: auto-fail stale pending payments when a payment is confirmed
CREATE OR REPLACE FUNCTION fn_auto_fail_stale_pending_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    UPDATE billing_payments
    SET status = 'failed',
        legacy_note = COALESCE(legacy_note, '') || 
          CASE WHEN legacy_note IS NOT NULL AND legacy_note != '' THEN ' | ' ELSE '' END ||
          'Auto-failed: superseded by confirmed payment ' || NEW.payment_number || ' at ' || now()::text
    WHERE invoice_id = NEW.invoice_id
      AND id != NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fail_stale_payments ON billing_payments;
CREATE TRIGGER trg_auto_fail_stale_payments
  AFTER UPDATE OF status ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_fail_stale_pending_payments();

-- Also on INSERT of already-confirmed payment
CREATE OR REPLACE FUNCTION fn_auto_fail_stale_payments_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE billing_payments
    SET status = 'failed',
        legacy_note = COALESCE(legacy_note, '') || 
          CASE WHEN legacy_note IS NOT NULL AND legacy_note != '' THEN ' | ' ELSE '' END ||
          'Auto-failed: superseded by confirmed payment ' || NEW.payment_number || ' at ' || now()::text
    WHERE invoice_id = NEW.invoice_id
      AND id != NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fail_stale_payments_on_insert ON billing_payments;
CREATE TRIGGER trg_auto_fail_stale_payments_on_insert
  AFTER INSERT ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_fail_stale_payments_on_insert();

-- 3. Trigger: prevent invoice-subscription cross-order mismatch
CREATE OR REPLACE FUNCTION fn_validate_invoice_subscription_order_match()
RETURNS TRIGGER AS $$
DECLARE
  sub_order_id UUID;
BEGIN
  IF NEW.subscription_id IS NOT NULL AND NEW.order_id IS NOT NULL THEN
    SELECT order_id INTO sub_order_id
    FROM billing_subscriptions
    WHERE id = NEW.subscription_id;
    
    IF sub_order_id IS NOT NULL AND sub_order_id != NEW.order_id THEN
      RAISE EXCEPTION 'Invoice order_id (%) does not match subscription order_id (%). Cross-order mismatch blocked.',
        NEW.order_id, sub_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_invoice_sub_order_match ON billing_invoices;
CREATE TRIGGER trg_validate_invoice_sub_order_match
  BEFORE INSERT OR UPDATE OF subscription_id, order_id ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_invoice_subscription_order_match();

-- 4. Trigger: orders must have account_id
CREATE OR REPLACE FUNCTION fn_require_order_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'Order must have an account_id. Resolve or create the customer account before inserting. Order: %, user_id: %',
      COALESCE(NEW.order_number, NEW.id::text), NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_require_order_account_id ON orders;
CREATE TRIGGER trg_require_order_account_id
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_require_order_account_id();
