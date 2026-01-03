-- Add status column to user_roles for staff status management
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'disabled', 'hold'));

-- Add comment for documentation
COMMENT ON COLUMN public.user_roles.status IS 'Staff account status: active, disabled, or hold. Non-active users cannot login.';