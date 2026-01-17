-- Remove vulnerable policies that allow public access with USING(true)
-- These are the old policies that bypass role checks

DROP POLICY IF EXISTS "Admins can view all direct emails" ON public.direct_emails;
DROP POLICY IF EXISTS "Admins can view all direct email recipients" ON public.direct_email_recipients;