-- Add missing enum values to billing_payment_status for admin capture/cancel/refund flow
ALTER TYPE billing_payment_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE billing_payment_status ADD VALUE IF NOT EXISTS 'refunded';