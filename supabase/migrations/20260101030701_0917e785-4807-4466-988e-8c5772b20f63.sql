-- Add employee role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Add enhanced activity log columns for tracking who made changes
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS actor_role text,
ADD COLUMN IF NOT EXISTS actor_name text,
ADD COLUMN IF NOT EXISTS actor_email text,
ADD COLUMN IF NOT EXISTS changed_field text,
ADD COLUMN IF NOT EXISTS reason text,
ADD COLUMN IF NOT EXISTS old_value text,
ADD COLUMN IF NOT EXISTS new_value text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON public.activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);