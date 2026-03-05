
-- Add KYC policy to orders: per_account reuses approved sessions, per_order forces fresh
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kyc_policy text NOT NULL DEFAULT 'per_account';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS require_fresh_kyc boolean NOT NULL DEFAULT false;

-- Add a column to track which KYC session was explicitly chosen for this order
-- (distinct from the trigger-linked one, this is the user's explicit choice)
COMMENT ON COLUMN public.orders.kyc_policy IS 'per_account: reuse approved KYC across orders. per_order: require fresh KYC session for each order.';

NOTIFY pgrst, 'reload schema';
