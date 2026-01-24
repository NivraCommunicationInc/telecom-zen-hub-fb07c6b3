-- ============================================================
-- V2 FINAL LOCKDOWN: Trigger amount_paid + Cleanup old crons
-- ============================================================

-- 1. Trigger pour synchroniser amount_paid depuis billing_payments
-- Quand un paiement est confirmé, on recalcule amount_paid sur la facture
CREATE OR REPLACE FUNCTION sync_invoice_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer amount_paid = somme des paiements confirmés
  UPDATE billing_invoices
  SET amount_paid = COALESCE((
    SELECT SUM(amount) 
    FROM billing_payments 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
      AND status = 'confirmed'
  ), 0)
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- balance_due sera mis à jour par le trigger sync_billing_invoice_balance existant
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur billing_payments (INSERT, UPDATE, DELETE)
DROP TRIGGER IF EXISTS trg_sync_invoice_amount_paid ON billing_payments;
CREATE TRIGGER trg_sync_invoice_amount_paid
AFTER INSERT OR UPDATE OR DELETE ON billing_payments
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_amount_paid();

-- 2. Supprimer les anciens crons daily avec tokens exposés
SELECT cron.unschedule('check-overdue-invoices-daily');

-- 3. S'assurer que seuls les 3 hourly + process-email-queue existent
-- (billing-check-overdue-hourly, billing-generate-renewals-hourly, payment-reminders-hourly sont déjà en place)