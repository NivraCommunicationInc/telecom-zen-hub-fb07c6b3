-- Add ID verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS service_address text,
ADD COLUMN IF NOT EXISTS service_city text,
ADD COLUMN IF NOT EXISTS service_province text DEFAULT 'QC',
ADD COLUMN IF NOT EXISTS service_postal_code text,
ADD COLUMN IF NOT EXISTS id_type text,
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS id_expiration date,
ADD COLUMN IF NOT EXISTS id_province text;