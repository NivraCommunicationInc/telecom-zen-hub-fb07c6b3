-- Fix: add columns required by apply_payment_to_invoice DB function
-- These columns were referenced in the function but never added to production tables
-- Root cause: migration 20260208003839 was not applied to production DB

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS billing_snapshot_payment JSONB DEFAULT NULL;

COMMENT ON COLUMN public.billing_invoices.billing_snapshot_payment IS
  'Payment confirmation data when paid: {method, paid_at, transaction_id, capture_id, last4, reference}';

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS auto_billing_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL;

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS suspension_date DATE DEFAULT NULL;
