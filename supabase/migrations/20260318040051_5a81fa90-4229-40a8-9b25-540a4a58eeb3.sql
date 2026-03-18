
-- VOID orphan checkout draft invoice #5979023
-- Reason: No order_id, no subscription_id, no invoice_lines, type=initial
-- Created during checkout draft phase before canonical invoice #8548553 was finalized
-- This phantom invoice was polluting the client's balance_due by 248.34$
UPDATE billing_invoices 
SET status = 'void', 
    balance_due = 0, 
    notes = 'VOIDED: Orphan checkout draft — canonical invoice is #8548553. Voided during hardening phase.'
WHERE invoice_number = '5979023' 
  AND order_id IS NULL 
  AND subscription_id IS NULL;
