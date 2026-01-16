-- =====================================================
-- SECURITY FIX: Remove remaining overly permissive policies
-- =====================================================

-- 1. Remove old policies on direct_email_recipients that target 'public' role
DROP POLICY IF EXISTS "Admins can insert direct email recipients" ON public.direct_email_recipients;
DROP POLICY IF EXISTS "Admins can update direct email recipients" ON public.direct_email_recipients;
DROP POLICY IF EXISTS "Admins can view direct email recipients" ON public.direct_email_recipients;
DROP POLICY IF EXISTS "Admins can delete direct email recipients" ON public.direct_email_recipients;

-- Recreate with proper restrictions (TO authenticated, not public)
CREATE POLICY "Staff can view direct email recipients"
ON public.direct_email_recipients FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can insert direct email recipients"
ON public.direct_email_recipients FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can update direct email recipients"
ON public.direct_email_recipients FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can delete direct email recipients"
ON public.direct_email_recipients FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

-- 2. Remove old policies on direct_emails that target 'public' role
DROP POLICY IF EXISTS "Admins can create direct emails" ON public.direct_emails;
DROP POLICY IF EXISTS "Admins can update direct emails" ON public.direct_emails;
DROP POLICY IF EXISTS "Admins can view direct emails" ON public.direct_emails;
DROP POLICY IF EXISTS "Admins can delete direct emails" ON public.direct_emails;

-- Recreate with proper restrictions
CREATE POLICY "Staff can view direct emails"
ON public.direct_emails FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can create direct emails"
ON public.direct_emails FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can update direct emails"
ON public.direct_emails FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

CREATE POLICY "Staff can delete direct emails"
ON public.direct_emails FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

-- 3. Fix live_activity_logs - currently allows anyone to insert
DROP POLICY IF EXISTS "Anyone can insert activity" ON public.live_activity_logs;

-- Allow authenticated users only (for tracking user activity)
CREATE POLICY "Authenticated users can insert activity"
ON public.live_activity_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anonymous for basic tracking but with rate limiting consideration
CREATE POLICY "Anonymous can insert limited activity"
ON public.live_activity_logs FOR INSERT
TO anon
WITH CHECK (
  -- Only allow insertion without sensitive data
  user_id IS NULL
);