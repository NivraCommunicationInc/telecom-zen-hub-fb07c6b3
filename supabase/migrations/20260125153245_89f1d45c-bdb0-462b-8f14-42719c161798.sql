-- Add 'paypal' to the billing_payment_method enum
ALTER TYPE billing_payment_method ADD VALUE IF NOT EXISTS 'paypal';