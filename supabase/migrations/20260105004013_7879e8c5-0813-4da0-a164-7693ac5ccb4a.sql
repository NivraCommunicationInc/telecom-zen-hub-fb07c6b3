-- Add contract_summary_snapshot column to order_snapshots table
-- This stores the rendered summary data at the moment of contract creation (immutable)
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS contract_summary_snapshot jsonb DEFAULT '{}';

-- Add bill_cycle_day column to store billing cycle day at order time
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS bill_cycle_day integer;

-- Add account_id reference for linking to account at snapshot time
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS account_id uuid;

-- Add activation_date for the estimated activation date
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS activation_date timestamptz;

-- Add payment_method_snapshot for payment info at order time
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS payment_method_snapshot jsonb DEFAULT '{}';

-- Add selected_channels_snapshot for TV channels at order time
ALTER TABLE public.order_snapshots 
ADD COLUMN IF NOT EXISTS selected_channels_snapshot jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.order_snapshots.contract_summary_snapshot IS 'Immutable snapshot of the contract summary page data rendered at order confirmation';
COMMENT ON COLUMN public.order_snapshots.bill_cycle_day IS 'Billing cycle day (1-28) captured at order time';
COMMENT ON COLUMN public.order_snapshots.payment_method_snapshot IS 'Payment method and rules captured at order time';