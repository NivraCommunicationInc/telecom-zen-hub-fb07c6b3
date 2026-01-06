-- Add online access blocking fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS online_access_status TEXT DEFAULT 'active' CHECK (online_access_status IN ('active', 'blocked')),
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID,
  ADD COLUMN IF NOT EXISTS blocked_by_role TEXT;

-- Update account_status constraint if it doesn't have CHECK
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check CHECK (account_status IN ('active', 'blocked'));

-- Comment on columns
COMMENT ON COLUMN public.profiles.online_access_status IS 'Controls portal access: active=can access, blocked=redirected to access-blocked page';
COMMENT ON COLUMN public.profiles.account_status IS 'Controls account actions: active=full access, blocked=read-only (cannot place orders)';
COMMENT ON COLUMN public.profiles.blocked_reason IS 'Required reason when account or online access is blocked';
COMMENT ON COLUMN public.profiles.blocked_at IS 'Timestamp when block was applied';
COMMENT ON COLUMN public.profiles.blocked_by IS 'Staff user ID who applied the block';
COMMENT ON COLUMN public.profiles.blocked_by_role IS 'Role of staff who applied block (admin/employee)';

-- Create index for quick lookup of blocked accounts
CREATE INDEX IF NOT EXISTS idx_profiles_online_access_status ON public.profiles(online_access_status) WHERE online_access_status = 'blocked';
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status) WHERE account_status = 'blocked';