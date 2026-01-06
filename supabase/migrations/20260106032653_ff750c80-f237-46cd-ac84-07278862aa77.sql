-- Ensure idempotency key exists and is globally unique
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- Backfill for existing rows
UPDATE public.orders
SET client_request_id = gen_random_uuid()
WHERE client_request_id IS NULL;

-- Default for new rows (still always provided by frontend)
ALTER TABLE public.orders
ALTER COLUMN client_request_id SET DEFAULT gen_random_uuid();

-- Enforce NOT NULL
ALTER TABLE public.orders
ALTER COLUMN client_request_id SET NOT NULL;

-- Global uniqueness (works even if user_id is null/slow)
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_uidx
ON public.orders (client_request_id);
