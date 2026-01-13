-- Add admin@nivra.com to admin_users table
INSERT INTO public.admin_users (user_id, is_active, notes)
VALUES ('4645f314-c426-408b-a571-860ef895ed04', true, 'Primary admin account')
ON CONFLICT (user_id) DO UPDATE SET is_active = true;

-- Update RLS policy for commission_ledger_entries to properly check admin_users
DROP POLICY IF EXISTS "Admin can manage ledger" ON public.commission_ledger_entries;

CREATE POLICY "Admin can manage ledger" ON public.commission_ledger_entries
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);