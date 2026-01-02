-- Add new columns to contact_requests for improved form
ALTER TABLE public.contact_requests 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS consent_given boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_apartment text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_province text DEFAULT 'QC',
ADD COLUMN IF NOT EXISTS address_postal_code text,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'website_contact';

-- Add CHECK constraints for server-side validation
-- Email format validation (basic pattern)
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_email_format;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Phone format validation (10-15 digits after removing non-digits)
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_phone_format;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_phone_format 
CHECK (length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 10 AND 15);

-- Message/notes length validation (max 2000 chars)
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_notes_length;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_notes_length 
CHECK (notes IS NULL OR length(notes) <= 2000);

-- Canadian postal code format validation (if provided)
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_postal_code_format;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_postal_code_format 
CHECK (address_postal_code IS NULL OR address_postal_code = '' OR 
       address_postal_code ~* '^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$');

-- Subject must be from allowed list (if provided)
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_subject_valid;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_subject_valid 
CHECK (subject IS NULL OR subject IN (
  'new_order', 'billing', 'tech_support', 'number_transfer', 
  'installation', 'delivery', 'complaint', 'other'
));

-- Preferred contact must be valid
ALTER TABLE public.contact_requests 
DROP CONSTRAINT IF EXISTS contact_requests_preferred_contact_valid;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_preferred_contact_valid 
CHECK (preferred_contact IS NULL OR preferred_contact IN ('email', 'phone'));

-- Sanitization trigger for contact requests
CREATE OR REPLACE FUNCTION public.sanitize_contact_request()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := COALESCE(trim(NEW.first_name), '') || ' ' || COALESCE(trim(NEW.last_name), '');
  NEW.name := trim(NEW.name);
  NEW.email := lower(trim(NEW.email));
  NEW.phone := trim(NEW.phone);
  IF NEW.first_name IS NOT NULL THEN
    NEW.first_name := trim(NEW.first_name);
  END IF;
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := trim(NEW.last_name);
  END IF;
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := trim(NEW.notes);
  END IF;
  IF NEW.address_street IS NOT NULL THEN
    NEW.address_street := trim(NEW.address_street);
  END IF;
  IF NEW.address_city IS NOT NULL THEN
    NEW.address_city := trim(NEW.address_city);
  END IF;
  IF NEW.address_postal_code IS NOT NULL THEN
    NEW.address_postal_code := upper(trim(NEW.address_postal_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS sanitize_contact_request_trigger ON public.contact_requests;
CREATE TRIGGER sanitize_contact_request_trigger
  BEFORE INSERT OR UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_contact_request();

-- Update RLS policies to ensure public cannot read contact_requests
-- First drop any existing public select policy
DROP POLICY IF EXISTS "Public can read contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Anyone can read contact requests" ON public.contact_requests;

-- Ensure the INSERT policy for public submissions is secure
DROP POLICY IF EXISTS "Public can submit contact requests" ON public.contact_requests;
CREATE POLICY "Public can submit contact requests"
ON public.contact_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Only allow setting safe fields, prevent setting admin-only fields
  internal_notes IS NULL 
  AND (priority IS NULL OR priority = 'normal')
  AND status = 'new'
  AND consent_given = true
);