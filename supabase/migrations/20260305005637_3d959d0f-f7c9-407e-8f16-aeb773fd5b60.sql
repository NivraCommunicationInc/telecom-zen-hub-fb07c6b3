-- Guard anti-double facture: prevent duplicate invoices for the same order
-- Only one non-voided invoice per order_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_unique_order
ON billing_invoices (order_id)
WHERE order_id IS NOT NULL AND status NOT IN ('void', 'cancelled');