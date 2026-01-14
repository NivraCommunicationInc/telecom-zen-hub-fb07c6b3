-- Fix RLS: email_templates must be writable by admins in admin portal

DROP POLICY IF EXISTS "Staff can manage email_templates" ON public.email_templates;

CREATE POLICY "Admins can manage email_templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
