-- BILLING V2 INTERAC-ONLY: Remove Stripe/Square from payment method enum
-- This is a breaking change that enforces Interac-only payments

-- Step 1: Drop defaults first before altering column type
ALTER TABLE billing_invoices ALTER COLUMN payment_method DROP DEFAULT;
ALTER TABLE billing_payments ALTER COLUMN method DROP DEFAULT;

-- Step 2: Create new enum with only interac and manual
CREATE TYPE billing_payment_method_v2 AS ENUM ('interac', 'manual');

-- Step 3: Update existing records to use 'interac' if they had stripe/square
UPDATE billing_invoices 
SET payment_method = 'interac' 
WHERE payment_method::text IN ('stripe', 'square');

UPDATE billing_payments 
SET method = 'interac' 
WHERE method::text IN ('stripe', 'square');

-- Step 4: Alter columns to use new enum
ALTER TABLE billing_invoices 
  ALTER COLUMN payment_method TYPE billing_payment_method_v2 
  USING payment_method::text::billing_payment_method_v2;

ALTER TABLE billing_payments 
  ALTER COLUMN method TYPE billing_payment_method_v2 
  USING method::text::billing_payment_method_v2;

-- Step 5: Set new defaults (interac)
ALTER TABLE billing_invoices ALTER COLUMN payment_method SET DEFAULT 'interac'::billing_payment_method_v2;
ALTER TABLE billing_payments ALTER COLUMN method SET DEFAULT 'interac'::billing_payment_method_v2;

-- Step 6: Drop old enum (if it still exists after previous failed migration)
DROP TYPE IF EXISTS billing_payment_method_new;
DROP TYPE IF EXISTS billing_payment_method;

-- Step 7: Rename new enum to standard name
ALTER TYPE billing_payment_method_v2 RENAME TO billing_payment_method;

-- Step 8: Add activation_fee field to billing_invoices for multi-service pricing
ALTER TABLE billing_invoices 
  ADD COLUMN IF NOT EXISTS activation_fee NUMERIC(10,2) DEFAULT 0;

-- Step 9: Add service_category to billing_subscriptions
ALTER TABLE billing_subscriptions 
  ADD COLUMN IF NOT EXISTS service_category TEXT;

-- Step 10: Create function to calculate activation fee based on service count
CREATE OR REPLACE FUNCTION calculate_activation_fee(service_count INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  IF service_count IS NULL OR service_count <= 0 THEN
    RETURN 0;
  ELSIF service_count = 1 THEN
    RETURN 25.00;
  ELSE
    RETURN 45.00; -- Flat fee for 2+ services
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;