-- Clients can submit a plan change request for themselves
CREATE POLICY "Clients can create their own change requests"
ON public.service_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = service_change_requests.account_id
      AND a.client_id = auth.uid()
  )
);

-- Clients can view their own change requests
CREATE POLICY "Clients can view their own change requests"
ON public.service_change_requests
FOR SELECT
TO authenticated
USING (client_id = auth.uid());
