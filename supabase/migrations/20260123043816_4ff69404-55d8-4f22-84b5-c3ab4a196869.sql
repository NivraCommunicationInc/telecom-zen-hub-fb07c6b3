
-- Align Billing V2 RLS with admin role source of truth (public.user_roles)

-- Helper: check if current user is an active admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
      AND ur.status = 'active'
      AND COALESCE(ur.is_active, true) = true
  );
$$;

-- billing_customers
DROP POLICY IF EXISTS "Admins full access billing_customers" ON public.billing_customers;
CREATE POLICY "Admins full access billing_customers"
ON public.billing_customers
FOR ALL
TO public
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- billing_subscriptions
DROP POLICY IF EXISTS "Admins full access billing_subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Admins full access billing_subscriptions"
ON public.billing_subscriptions
FOR ALL
TO public
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- billing_invoices
DROP POLICY IF EXISTS "Admins full access billing_invoices" ON public.billing_invoices;
CREATE POLICY "Admins full access billing_invoices"
ON public.billing_invoices
FOR ALL
TO public
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- billing_invoice_lines
DROP POLICY IF EXISTS "Admins full access billing_invoice_lines" ON public.billing_invoice_lines;
CREATE POLICY "Admins full access billing_invoice_lines"
ON public.billing_invoice_lines
FOR ALL
TO public
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- billing_payments
DROP POLICY IF EXISTS "Admins full access billing_payments" ON public.billing_payments;
CREATE POLICY "Admins full access billing_payments"
ON public.billing_payments
FOR ALL
TO public
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
