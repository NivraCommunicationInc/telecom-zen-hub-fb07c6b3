DROP POLICY IF EXISTS rma_client_read_own ON public.rma_requests;

CREATE POLICY rma_client_read_own
ON public.rma_requests
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id
    FROM public.accounts a
    WHERE a.client_id = auth.uid()
  )
);