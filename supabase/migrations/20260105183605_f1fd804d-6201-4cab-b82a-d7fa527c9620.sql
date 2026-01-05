-- Fix: Update accounts.billing_cycle_day constraint to allow 1-31
-- The clamping for short months (Feb, Apr, Jun, Sep, Nov) happens at invoice generation time

-- Drop the old constraint
ALTER TABLE public.accounts
DROP CONSTRAINT IF EXISTS accounts_billing_cycle_day_check;

-- Add new constraint allowing 1-31
ALTER TABLE public.accounts
ADD CONSTRAINT accounts_billing_cycle_day_check
CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 31);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';