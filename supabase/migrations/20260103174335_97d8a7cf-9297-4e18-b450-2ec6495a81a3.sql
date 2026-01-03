-- Add permissions jsonb column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.user_roles.permissions IS 'JSON object storing granular permissions for the user. Keys: view_clients, manage_orders, view_billing, manage_appointments, view_logs, export_data, manage_staff, etc.';