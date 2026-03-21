-- REPAIR: Fix orders/invoices/payments incorrectly marked as paid while Stripe PI is still uncaptured

-- Fix billing_payments: set back to pending/authorized
UPDATE billing_payments
SET status = 'pending',
    authorization_status = 'authorized',
    authorized_amount = amount,
    authorized_at = created_at,
    received_at = NULL,
    captured_at = NULL,
    stripe_payment_intent_id = provider_payment_id
WHERE provider_payment_id IN ('pi_3TDDXH0SJA9ekHDi0HTMEjs3', 'pi_3TD9yx0SJA9ekHDi0XDspcps')
  AND authorization_status != 'authorized';

-- Fix billing_invoices: set back to pending (not paid)
UPDATE billing_invoices
SET status = 'pending',
    amount_paid = 0,
    balance_due = total,
    paid_at = NULL
WHERE id IN (
  SELECT invoice_id FROM billing_payments 
  WHERE provider_payment_id IN ('pi_3TDDXH0SJA9ekHDi0HTMEjs3', 'pi_3TD9yx0SJA9ekHDi0XDspcps')
);

-- Fix orders: set back to pending_admin_review
UPDATE orders
SET status = 'pending_admin_review',
    payment_status = 'authorized',
    payment_authorization_status = 'authorized'
WHERE id IN (
  SELECT order_id FROM billing_invoices WHERE id IN (
    SELECT invoice_id FROM billing_payments 
    WHERE provider_payment_id IN ('pi_3TDDXH0SJA9ekHDi0HTMEjs3', 'pi_3TD9yx0SJA9ekHDi0XDspcps')
  )
);