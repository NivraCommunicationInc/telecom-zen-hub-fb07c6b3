-- AUDIT FIX B-6: Normalize billing_subscriptions.service_category casing
-- Found: 'internet' (lowercase) alongside 'Internet', 'Mobile', 'TV'
-- Standard: Title case across all categories

UPDATE public.billing_subscriptions
  SET service_category = 'Internet'
  WHERE service_category = 'internet';

-- Add a CHECK constraint to prevent future casing drift
-- Allow the 4 known categories only
ALTER TABLE public.billing_subscriptions
  DROP CONSTRAINT IF EXISTS chk_service_category_valid;

ALTER TABLE public.billing_subscriptions
  ADD CONSTRAINT chk_service_category_valid
  CHECK (service_category IN ('Internet', 'Mobile', 'TV', 'VoIP', 'Bundle', 'Other') OR service_category IS NULL);
