ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS tracking_last_update_at TIMESTAMPTZ;