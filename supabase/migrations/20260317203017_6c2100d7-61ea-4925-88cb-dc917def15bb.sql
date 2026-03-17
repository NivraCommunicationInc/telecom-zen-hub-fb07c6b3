-- Add 'card' to billing_payment_method enum for Stripe card payments
ALTER TYPE billing_payment_method ADD VALUE IF NOT EXISTS 'card';