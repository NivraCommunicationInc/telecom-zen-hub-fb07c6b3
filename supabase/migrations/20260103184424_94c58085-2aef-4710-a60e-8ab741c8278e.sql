-- Add columns to user_roles for status tracking
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS require_password_change boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON public.user_roles(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Comment for documentation
COMMENT ON COLUMN public.user_roles.permissions IS 'JSONB storing granular permissions for the user';
COMMENT ON COLUMN public.user_roles.is_active IS 'Whether the staff account is active';
COMMENT ON COLUMN public.user_roles.require_password_change IS 'Whether user must change password on next login';
COMMENT ON COLUMN public.user_roles.last_login_at IS 'Timestamp of last successful login';