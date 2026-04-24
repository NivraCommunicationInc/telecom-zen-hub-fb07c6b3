
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS created_by_agent_id UUID,
  ADD COLUMN IF NOT EXISTS agent_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_agent_id ON public.orders(created_by_agent_id);
