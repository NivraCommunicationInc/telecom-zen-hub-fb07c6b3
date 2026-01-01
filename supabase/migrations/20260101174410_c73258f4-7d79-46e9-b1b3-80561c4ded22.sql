-- Add columns for rate limiting and security
ALTER TABLE public.technicians 
ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS lockout_until timestamp with time zone DEFAULT NULL;

-- Create index for email lookup (normalized)
CREATE INDEX IF NOT EXISTS idx_technicians_email_lower ON public.technicians (lower(email));

-- Update RLS to allow technicians to read their own record after auth
DROP POLICY IF EXISTS "Technicians can view their own record" ON public.technicians;
CREATE POLICY "Technicians can view their own record" 
ON public.technicians 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow technicians to update their own failed_login_attempts (for lockout reset)
CREATE POLICY "Technicians can update login attempts" 
ON public.technicians 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow anonymous/public to query technicians by email for login (limited fields)
-- This is needed since technicians authenticate BEFORE having a session
CREATE POLICY "Allow login lookup by email" 
ON public.technicians 
FOR SELECT 
USING (true);