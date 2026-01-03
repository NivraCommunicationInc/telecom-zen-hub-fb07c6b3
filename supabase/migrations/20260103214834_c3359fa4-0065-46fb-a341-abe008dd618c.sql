-- Add password_hash column to employees table for employee/technician password support
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT true;

-- Add admin_pin_hash column to user_roles for admin 8-digit PIN
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS admin_pin_hash TEXT;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS require_pin_change BOOLEAN DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS last_auth_check_at TIMESTAMP WITH TIME ZONE;

-- Add password_hash and require_password_change to technicians table
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT true;

-- Add last_auth_check_at to profiles for session validation gate
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_auth_check_at TIMESTAMP WITH TIME ZONE;