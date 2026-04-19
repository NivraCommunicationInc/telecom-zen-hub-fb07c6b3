-- Phase 7: allow clients to read equipment_inventory rows linked to one of their own accounts
CREATE POLICY "Clients can view their own equipment"
ON public.equipment_inventory
FOR SELECT
TO authenticated
USING (
  account_id IS NOT NULL
  AND account_id IN (
    SELECT id FROM public.accounts WHERE client_id = auth.uid()
  )
);