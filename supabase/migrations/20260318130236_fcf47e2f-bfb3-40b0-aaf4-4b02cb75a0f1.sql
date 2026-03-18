
-- Fix existing order #80876: align total_amount with invoice total
UPDATE orders 
SET total_amount = (
  SELECT total FROM billing_invoices WHERE order_id = orders.id LIMIT 1
)
WHERE order_number = '80876' 
  AND total_amount != (SELECT total FROM billing_invoices WHERE order_id = orders.id LIMIT 1);

-- Fix existing subscription for order #80876: activate since invoice is paid
UPDATE billing_subscriptions
SET status = 'active',
    last_invoice_id = (
      SELECT id FROM billing_invoices WHERE order_id = billing_subscriptions.order_id AND status = 'paid' LIMIT 1
    )
WHERE order_id = (SELECT id FROM orders WHERE order_number = '80876')
  AND status != 'active';

-- Link invoice to subscription for order #80876
UPDATE billing_invoices
SET subscription_id = (
  SELECT id FROM billing_subscriptions WHERE order_id = billing_invoices.order_id LIMIT 1
)
WHERE order_id = (SELECT id FROM orders WHERE order_number = '80876')
  AND subscription_id IS NULL;
