
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dob_locked boolean DEFAULT true;
