
-- Fix order_internal_notes INSERT policy to use has_role instead of legacy check
DROP POLICY IF EXISTS "Admin and employees can create order notes" ON public.order_internal_notes;
CREATE POLICY "Staff can create order notes" ON public.order_internal_notes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- Fix order_internal_notes SELECT policy similarly
DROP POLICY IF EXISTS "Admin and employees can view order notes" ON public.order_internal_notes;
CREATE POLICY "Staff can view order notes" ON public.order_internal_notes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- Fix client_documents: allow employees too
DROP POLICY IF EXISTS "Admin only - client_documents" ON public.client_documents;
CREATE POLICY "Staff can manage all documents" ON public.client_documents
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- Fix client_profile_changes INSERT: allow employees too
DROP POLICY IF EXISTS "Admins can log profile changes" ON public.client_profile_changes;
CREATE POLICY "Staff can log profile changes" ON public.client_profile_changes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (auth.uid() = client_id AND changed_by_id = auth.uid())
);

-- Fix client_profile_changes SELECT: allow employees too
DROP POLICY IF EXISTS "Admins can view all profile changes" ON public.client_profile_changes;
CREATE POLICY "Staff can view all profile changes" ON public.client_profile_changes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR auth.uid() = client_id
);

-- Fix document_requests: add user_roles check alongside admin_users
DROP POLICY IF EXISTS "Admins can manage document requests" ON public.document_requests;
CREATE POLICY "Staff can manage document requests" ON public.document_requests
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true)
);

-- Fix system_status: allow employees to manage too
DROP POLICY IF EXISTS "Admins can manage all system status" ON public.system_status;
CREATE POLICY "Staff can manage all system status" ON public.system_status
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- Fix payments: ensure employees can also insert payments for clients
DROP POLICY IF EXISTS "Admin only - payments" ON public.payments;
CREATE POLICY "Staff can manage all payments" ON public.payments
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);
