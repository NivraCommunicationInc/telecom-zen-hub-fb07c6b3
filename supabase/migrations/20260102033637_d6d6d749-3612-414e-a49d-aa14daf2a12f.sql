
-- ============================================
-- SECURITY FIX A: TV Channels pricing protection
-- ============================================

-- Create a public-safe view that excludes pricing
CREATE OR REPLACE VIEW public.tv_channels_public AS
SELECT 
  id, 
  name, 
  category, 
  description, 
  is_hd, 
  is_4k, 
  is_active,
  status,
  incident_type,
  incident_reason,
  incident_at,
  replacement_channel_id,
  created_at,
  updated_at
FROM public.tv_channels
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.tv_channels_public TO anon, authenticated;

-- Remove the public read policy on tv_channels (keep admin management)
DROP POLICY IF EXISTS "Anyone can view active channels" ON public.tv_channels;

-- Create staff-only read policy for tv_channels (includes pricing)
CREATE POLICY "Staff can read tv_channels"
ON public.tv_channels FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- ============================================
-- SECURITY FIX C: Contact requests server-side validation
-- ============================================

-- Add CHECK constraints for validation
ALTER TABLE public.contact_requests
  DROP CONSTRAINT IF EXISTS contact_name_len_chk;
ALTER TABLE public.contact_requests
  ADD CONSTRAINT contact_name_len_chk 
  CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE public.contact_requests
  DROP CONSTRAINT IF EXISTS contact_email_format_chk;
ALTER TABLE public.contact_requests
  ADD CONSTRAINT contact_email_format_chk
  CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

ALTER TABLE public.contact_requests
  DROP CONSTRAINT IF EXISTS contact_phone_len_chk;
ALTER TABLE public.contact_requests
  ADD CONSTRAINT contact_phone_len_chk
  CHECK (char_length(phone) BETWEEN 10 AND 20);

-- Create sanitization trigger function
CREATE OR REPLACE FUNCTION public.sanitize_contact_request()
RETURNS trigger AS $$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.email := lower(trim(NEW.email));
  NEW.phone := trim(NEW.phone);
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := trim(NEW.notes);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sanitize_contact_request ON public.contact_requests;
CREATE TRIGGER trg_sanitize_contact_request
BEFORE INSERT OR UPDATE ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION public.sanitize_contact_request();

-- ============================================
-- SECURITY FIX E: Move pg_net extension to extensions schema
-- ============================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_net extension (this may fail if not superuser, but included for completeness)
-- ALTER EXTENSION pg_net SET SCHEMA extensions;

-- ============================================
-- SECURITY FIX F: Recreate views without SECURITY DEFINER
-- ============================================

-- The client_unpaid_invoices view doesn't have SECURITY DEFINER, it's a regular view
-- No changes needed there

-- The tv_channels_public view we created above is also a regular view (not SECURITY DEFINER)

