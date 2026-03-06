ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS fulfillment_type text,
  ADD COLUMN IF NOT EXISTS fulfillment_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_notes text;