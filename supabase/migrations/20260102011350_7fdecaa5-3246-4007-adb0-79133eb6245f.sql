-- Add new columns for PIN security
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS client_pin_hash TEXT,
ADD COLUMN IF NOT EXISTS pin_is_default BOOLEAN DEFAULT false;

-- Create a function to hash PINs (SHA-256 with salt)
CREATE OR REPLACE FUNCTION public.hash_pin(pin TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(('nivra_pin_salt_2026' || pin)::bytea), 'hex')
$$;

-- Update all existing profiles to have default PIN 3112 (hashed)
-- Only set if client_pin_hash is null (no PIN set yet)
UPDATE public.profiles
SET 
  client_pin_hash = public.hash_pin('3112'),
  pin_is_default = true
WHERE client_pin_hash IS NULL;

-- Also set for any that have old plain text client_pin but no hash
UPDATE public.profiles
SET 
  client_pin_hash = public.hash_pin(client_pin),
  pin_is_default = false
WHERE client_pin IS NOT NULL 
  AND client_pin_hash IS NULL
  AND length(client_pin) = 4;

-- Create a table for PIN change logs (admin visibility only)
CREATE TABLE IF NOT EXISTS public.client_pin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  client_email TEXT,
  changed_by_id UUID NOT NULL,
  changed_by_name TEXT,
  changed_by_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('set', 'change', 'reset_to_default', 'forced_change')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on PIN logs
ALTER TABLE public.client_pin_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view PIN logs
CREATE POLICY "Admins can manage PIN logs"
ON public.client_pin_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can insert PIN logs
CREATE POLICY "Staff can insert PIN logs"
ON public.client_pin_logs FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'employee'::app_role) OR
  auth.uid() IS NOT NULL
);

-- Create a verify_pin function for secure comparison
CREATE OR REPLACE FUNCTION public.verify_pin(user_id_input UUID, pin_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
  input_hash TEXT;
BEGIN
  SELECT client_pin_hash INTO stored_hash
  FROM public.profiles
  WHERE user_id = user_id_input;
  
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  input_hash := public.hash_pin(pin_input);
  RETURN stored_hash = input_hash;
END;
$$;