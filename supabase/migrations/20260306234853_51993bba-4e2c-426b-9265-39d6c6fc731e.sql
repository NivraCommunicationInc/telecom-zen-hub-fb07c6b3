-- Allow authenticated employees to insert into email_queue
CREATE POLICY "Authenticated employees can insert email queue"
ON public.email_queue
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'employee'::app_role)
);