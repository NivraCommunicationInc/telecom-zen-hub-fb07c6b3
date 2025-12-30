-- Make client_id nullable so appointments can be created before user signup
ALTER TABLE public.appointments ALTER COLUMN client_id DROP NOT NULL;

-- Drop and recreate the trigger function to properly link appointments
CREATE OR REPLACE FUNCTION public.link_appointments_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any appointments with matching email to this new user
  UPDATE public.appointments 
  SET client_id = NEW.user_id
  WHERE client_email = NEW.email 
    AND (client_id IS NULL OR client_id = '00000000-0000-0000-0000-000000000000');
  
  -- Also link orders with matching email
  UPDATE public.orders
  SET user_id = NEW.user_id
  WHERE client_email = NEW.email 
    AND user_id = '00000000-0000-0000-0000-000000000000';
  
  -- Also link billing records with matching email
  UPDATE public.billing
  SET user_id = NEW.user_id
  WHERE client_email = NEW.email 
    AND user_id = '00000000-0000-0000-0000-000000000000';
  
  -- Also link support tickets with matching email
  UPDATE public.support_tickets
  SET user_id = NEW.user_id
  WHERE client_email = NEW.email 
    AND user_id = '00000000-0000-0000-0000-000000000000';
  
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist (it might already exist)
DROP TRIGGER IF EXISTS on_profile_created_link_data ON public.profiles;
CREATE TRIGGER on_profile_created_link_data
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_appointments_to_user();