-- Add page_url capture for contact form submissions
ALTER TABLE public.contact_requests
ADD COLUMN IF NOT EXISTS page_url text;
