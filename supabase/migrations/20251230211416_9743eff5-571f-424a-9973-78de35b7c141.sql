-- Add email column to appointments for email-based matching
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON public.appointments(client_email);

-- Update RLS policy to allow users to see appointments by their email
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments
  FOR SELECT USING (
    auth.uid() = client_id 
    OR client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  );

-- Create function to link appointments when user signs up
CREATE OR REPLACE FUNCTION public.link_appointments_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any appointments with matching email to this new user
  UPDATE public.appointments 
  SET client_id = NEW.user_id
  WHERE client_email = NEW.email 
    AND client_id IS NULL;
  
  -- Also link billing records
  UPDATE public.billing
  SET user_id = NEW.user_id
  WHERE user_id IN (
    SELECT p.user_id FROM public.profiles p 
    WHERE p.email = NEW.email AND p.user_id != NEW.user_id
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to run when profile is created
DROP TRIGGER IF EXISTS on_profile_created_link_appointments ON public.profiles;
CREATE TRIGGER on_profile_created_link_appointments
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_appointments_to_user();

-- Add email columns to other tables for email-based matching
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Update orders RLS to include email matching
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (
    auth.uid() = user_id 
    OR client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  );

-- Update billing RLS to include email matching  
DROP POLICY IF EXISTS "Users can view their own billing" ON public.billing;
CREATE POLICY "Users can view their own billing" ON public.billing
  FOR SELECT USING (
    auth.uid() = user_id 
    OR client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  );

-- Update support_tickets RLS to include email matching
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING (
    auth.uid() = user_id 
    OR client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  );