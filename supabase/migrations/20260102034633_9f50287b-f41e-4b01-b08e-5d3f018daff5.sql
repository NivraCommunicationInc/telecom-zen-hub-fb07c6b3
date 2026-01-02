
-- ============================================
-- SECURITY FIX 1: Technicians table - remove public access
-- ============================================

-- Drop the overly permissive policy that allows anyone to read
DROP POLICY IF EXISTS "Allow login lookup by email" ON public.technicians;

-- Keep existing secure policies and add staff read policy
DROP POLICY IF EXISTS "Staff can read technicians" ON public.technicians;
CREATE POLICY "Staff can read technicians"
ON public.technicians
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
  OR auth.uid() = user_id
);

-- ============================================
-- SECURITY FIX 2: Work orders table - remove public access
-- ============================================

-- Drop the overly permissive policy that allows anyone to read
DROP POLICY IF EXISTS "Allow technician portal access" ON public.work_orders;

-- Create proper technician access policy
DROP POLICY IF EXISTS "Technicians can view assigned work orders secure" ON public.work_orders;
CREATE POLICY "Technicians can view assigned work orders secure"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  public.is_assigned_technician(id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- ============================================
-- SECURITY FIX 3: Billing table - ensure authenticated only
-- ============================================

-- Drop and recreate policies with proper roles
DROP POLICY IF EXISTS "Users can create their own billing records" ON public.billing;
CREATE POLICY "Users can create their own billing records"
ON public.billing
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own billing" ON public.billing;
DROP POLICY IF EXISTS "Staff can read all billing" ON public.billing;
CREATE POLICY "Staff can read all billing"
ON public.billing
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
  OR auth.uid() = user_id
);

-- ============================================
-- SECURITY FIX 4: Monthly invoices - ensure authenticated only
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all monthly invoices" ON public.monthly_invoices;
CREATE POLICY "Admins can manage all monthly invoices"
ON public.monthly_invoices
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Clients can view their own invoices" ON public.monthly_invoices;
CREATE POLICY "Clients can view their own invoices"
ON public.monthly_invoices
FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Employees can update invoice status" ON public.monthly_invoices;
CREATE POLICY "Employees can update invoice status"
ON public.monthly_invoices
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

DROP POLICY IF EXISTS "Employees can view all monthly invoices" ON public.monthly_invoices;
CREATE POLICY "Employees can view all monthly invoices"
ON public.monthly_invoices
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

-- ============================================
-- SECURITY FIX 5: Subscriptions - ensure authenticated only
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add employee access to subscriptions
CREATE POLICY "Employees can view all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

-- ============================================
-- SECURITY FIX 6: Monthly invoice lines - ensure authenticated only
-- ============================================

DROP POLICY IF EXISTS "Staff reads monthly_invoice_lines" ON public.monthly_invoice_lines;
CREATE POLICY "Staff can read all monthly_invoice_lines"
ON public.monthly_invoice_lines
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
);

DROP POLICY IF EXISTS "Client reads own monthly_invoice_lines" ON public.monthly_invoice_lines;
CREATE POLICY "Client reads own monthly_invoice_lines"
ON public.monthly_invoice_lines
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.monthly_invoices mi
    WHERE mi.id = monthly_invoice_lines.invoice_id
      AND mi.client_id = auth.uid()
  )
);

-- ============================================
-- Revoke anon access from client_unpaid_invoices view
-- ============================================
REVOKE ALL ON public.client_unpaid_invoices FROM anon;
GRANT SELECT ON public.client_unpaid_invoices TO authenticated;
