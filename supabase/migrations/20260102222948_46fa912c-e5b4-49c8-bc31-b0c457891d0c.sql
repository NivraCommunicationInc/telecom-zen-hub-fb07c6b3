-- Add missing columns to authorized_users table for permission levels and notifications
ALTER TABLE public.authorized_users 
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_opt_in boolean DEFAULT false;

-- Update permission_level to support new levels
COMMENT ON COLUMN public.authorized_users.permission_level IS 'level_1 (info only), level_2 (service requests), level_3 (billing assistance), level_4 (full representative)';

-- Add RLS policy for clients to manage their own authorized contacts
CREATE POLICY "Clients can view their own authorized contacts" 
ON public.authorized_users 
FOR SELECT 
USING (client_id = auth.uid());

CREATE POLICY "Clients can create their own authorized contacts" 
ON public.authorized_users 
FOR INSERT 
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update their own authorized contacts" 
ON public.authorized_users 
FOR UPDATE 
USING (client_id = auth.uid());

CREATE POLICY "Clients can delete their own authorized contacts" 
ON public.authorized_users 
FOR DELETE 
USING (client_id = auth.uid());

-- Add point_of_contact_id to support_tickets for linking to authorized contact
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS point_of_contact_id uuid REFERENCES public.authorized_users(id) ON DELETE SET NULL;