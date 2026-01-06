-- Add client_request_id for idempotent client checkout submits
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- Backfill existing rows so we can enforce NOT NULL + uniqueness safely
UPDATE public.orders
SET client_request_id = gen_random_uuid()
WHERE client_request_id IS NULL;

-- Ensure future inserts always have a value even if older code paths don't send one
ALTER TABLE public.orders
ALTER COLUMN client_request_id SET DEFAULT gen_random_uuid();

ALTER TABLE public.orders
ALTER COLUMN client_request_id SET NOT NULL;

-- Enforce idempotency per user
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_client_request_uidx
ON public.orders (user_id, client_request_id);
