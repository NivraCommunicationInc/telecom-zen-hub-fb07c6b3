-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can create contact requests" ON public.contact_requests;

-- Create a more restrictive INSERT policy that only allows public fields
-- and prevents setting internal_notes, priority, or status
CREATE POLICY "Public can submit contact requests"
ON public.contact_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Only allow setting name, email, phone, and notes (user message)
  -- internal_notes, priority, and status must be null or defaults
  internal_notes IS NULL 
  AND (priority IS NULL OR priority = 'normal')
  AND status = 'new'
);

-- Ensure the deny policies are using the correct role targeting
DROP POLICY IF EXISTS "Deny anonymous read on contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Deny anonymous update on contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Deny anonymous delete on contact_requests" ON public.contact_requests;

-- These restrictive policies ensure no data leakage for anonymous users
CREATE POLICY "Only admins can read contact requests"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update contact requests"
ON public.contact_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete contact requests"
ON public.contact_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));