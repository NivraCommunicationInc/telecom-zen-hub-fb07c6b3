
-- Add 'paid_by_promo' to billing_invoice_status enum for zero-total invoices
ALTER TYPE billing_invoice_status ADD VALUE IF NOT EXISTS 'paid_by_promo' AFTER 'paid';
