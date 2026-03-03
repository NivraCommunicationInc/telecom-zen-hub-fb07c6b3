
-- Add missing enum values for billing lifecycle
ALTER TYPE public.billing_subscription_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.billing_subscription_status ADD VALUE IF NOT EXISTS 'not_renewed';

ALTER TYPE public.billing_invoice_status ADD VALUE IF NOT EXISTS 'void';
ALTER TYPE public.billing_invoice_status ADD VALUE IF NOT EXISTS 'not_renewed';
