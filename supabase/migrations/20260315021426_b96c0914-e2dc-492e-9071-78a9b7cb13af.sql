-- 1) Revert entity_id back to UUID and add entity_reference TEXT column
-- for non-UUID references (order numbers, PayPal IDs, etc.)

ALTER TABLE public.billing_system_alerts
  ALTER COLUMN entity_id TYPE uuid USING CASE
    WHEN entity_id IS NULL THEN NULL
    WHEN entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN entity_id::uuid
    ELSE NULL
  END;

-- Add a text column for non-UUID entity references (order numbers, external IDs)
ALTER TABLE public.billing_system_alerts
  ADD COLUMN IF NOT EXISTS entity_reference text;

-- Add a column to flag canonical failure exceptions
ALTER TABLE public.billing_system_alerts
  ADD COLUMN IF NOT EXISTS is_canonical_exception boolean DEFAULT false;