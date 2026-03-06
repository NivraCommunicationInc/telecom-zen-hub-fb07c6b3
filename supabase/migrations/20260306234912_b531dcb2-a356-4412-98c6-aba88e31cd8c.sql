CREATE POLICY "Authenticated admins can insert email queue"
ON public.email_queue
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);