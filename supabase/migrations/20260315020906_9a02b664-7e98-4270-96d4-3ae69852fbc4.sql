
-- Fix entity_id column type: UUID → TEXT to accept all entity reference strings
ALTER TABLE public.billing_system_alerts 
  ALTER COLUMN entity_id TYPE text USING entity_id::text;
