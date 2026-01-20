-- ==============================================
-- TRIGGER: Recalculate subscription cycle dates when invoice is PAID
-- Business Rule: Cycle starts ONLY when payment is confirmed (prepaid model)
-- ==============================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_invoice_paid_update_subscription ON billing_invoices;
DROP FUNCTION IF EXISTS update_subscription_on_invoice_paid();

-- Create the function that updates subscription cycle dates based on payment confirmation
CREATE OR REPLACE FUNCTION update_subscription_on_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  payment_confirmed_at TIMESTAMPTZ;
  new_cycle_start DATE;
  new_cycle_end DATE;
BEGIN
  -- Only trigger when status changes from pending/overdue to paid
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'paid' THEN
    
    -- Get the exact payment confirmation timestamp
    payment_confirmed_at := COALESCE(NEW.paid_at, NOW());
    
    -- Calculate new cycle dates based on payment confirmation
    new_cycle_start := payment_confirmed_at::DATE;
    new_cycle_end := (payment_confirmed_at + INTERVAL '30 days')::DATE;
    
    -- Update the invoice with the real cycle dates
    NEW.cycle_start_date := new_cycle_start;
    NEW.cycle_end_date := new_cycle_end;
    
    -- Update the subscription with real cycle dates and activate it
    UPDATE billing_subscriptions
    SET 
      status = 'active',
      cycle_start_date = new_cycle_start,
      cycle_end_date = new_cycle_end,
      last_invoice_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.subscription_id;
    
    RAISE NOTICE '[billing-trigger] Invoice % paid at %. Subscription % activated with cycle % to %',
      NEW.invoice_number, payment_confirmed_at, NEW.subscription_id, new_cycle_start, new_cycle_end;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on billing_invoices
CREATE TRIGGER on_invoice_paid_update_subscription
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_on_invoice_paid();

-- Add comment for documentation
COMMENT ON FUNCTION update_subscription_on_invoice_paid() IS 
  'Automatically updates subscription cycle dates when invoice is marked as paid. 
   Cycle starts on payment confirmation date, not order date (prepaid model).';

-- ==============================================
-- Ensure new subscriptions start as pending (not active) until payment confirmed
-- Only update subscriptions that have no paid invoices
-- ==============================================
UPDATE billing_subscriptions bs
SET status = 'pending'
WHERE status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM billing_invoices bi 
    WHERE bi.subscription_id = bs.id 
    AND bi.status = 'paid'
  );