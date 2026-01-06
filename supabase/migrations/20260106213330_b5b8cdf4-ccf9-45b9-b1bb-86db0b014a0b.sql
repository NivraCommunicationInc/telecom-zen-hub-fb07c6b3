-- P0 FIX: Create trigger to automatically create profile on user signup
-- The handle_new_user() function already exists, just need to attach the trigger

-- First, drop if exists to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- P1 FIX: Add RLS policies for client_login_pins table
-- This table stores temporary PIN codes for 2FA, needs strict access control

-- Users can only see their own PINs
CREATE POLICY "Users can view their own login pins" 
  ON public.client_login_pins 
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own PINs (for requesting new codes)
CREATE POLICY "Users can create their own login pins" 
  ON public.client_login_pins 
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow edge functions (service role) to manage pins
CREATE POLICY "Service role manages login pins" 
  ON public.client_login_pins 
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can delete their own expired pins
CREATE POLICY "Users can delete their own login pins" 
  ON public.client_login_pins 
  FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid());