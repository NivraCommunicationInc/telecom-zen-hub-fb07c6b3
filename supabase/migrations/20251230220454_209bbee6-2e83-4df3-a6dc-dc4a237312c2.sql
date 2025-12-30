-- Add balance and account management fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS store_credit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'frozen', 'hold', 'deactivated'));

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.balance IS 'Current balance owed by the client';
COMMENT ON COLUMN public.profiles.store_credit IS 'Store credit available for future payments';
COMMENT ON COLUMN public.profiles.account_status IS 'Account status: active, frozen, hold, or deactivated';