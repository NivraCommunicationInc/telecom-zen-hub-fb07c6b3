
-- Clean: ensure voided invoice has balance_due = 0 for data hygiene
UPDATE billing_invoices SET balance_due = 0 WHERE invoice_number = '5979023' AND status = 'void';
