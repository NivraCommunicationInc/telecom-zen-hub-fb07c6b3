
-- =====================================================
-- COMPREHENSIVE SECURITY HARDENING
-- =====================================================

-- 1) Revoke ALL access from anon on sensitive tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.employees FROM anon;
REVOKE ALL ON public.technicians FROM anon;
REVOKE ALL ON public.payment_methods FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.billing FROM anon;
REVOKE ALL ON public.client_access_logs FROM anon;
REVOKE ALL ON public.client_activity_logs FROM anon;
REVOKE ALL ON public.appointments FROM anon;
REVOKE ALL ON public.authorized_users FROM anon;
REVOKE ALL ON public.accounts FROM anon;
REVOKE ALL ON public.subscriptions FROM anon;
REVOKE ALL ON public.contracts FROM anon;
REVOKE ALL ON public.support_tickets FROM anon;
REVOKE ALL ON public.monthly_invoices FROM anon;
REVOKE ALL ON public.monthly_invoice_lines FROM anon;

-- 2) Fix client_access_logs - Admin only for SELECT, staff for INSERT
DROP POLICY IF EXISTS "Staff can insert access logs" ON public.client_access_logs;
DROP POLICY IF EXISTS "Admins can view all access logs" ON public.client_access_logs;
DROP POLICY IF EXISTS "Admins can manage access logs" ON public.client_access_logs;

-- Admin can manage all
CREATE POLICY "Admin manages access logs"
ON public.client_access_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staff (admin/employee/technician) can INSERT their own logs only
CREATE POLICY "Staff inserts own access logs"
ON public.client_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  staff_user_id = auth.uid() AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'employee'::app_role) OR 
   has_role(auth.uid(), 'technician'::app_role))
);

-- 3) Fix client_activity_logs - Admin full access, employees see only their own actions
DROP POLICY IF EXISTS "Staff can insert client activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Admins can view all client activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Only admins can delete client activity logs" ON public.client_activity_logs;

-- Admin can manage all
CREATE POLICY "Admin manages activity logs"
ON public.client_activity_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staff can INSERT logs for actions they perform
CREATE POLICY "Staff inserts own activity logs"
ON public.client_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid() AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'employee'::app_role) OR 
   has_role(auth.uid(), 'technician'::app_role))
);

-- Employees can only SELECT logs where they were the actor
CREATE POLICY "Employee views own activity logs"
ON public.client_activity_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role) AND 
  actor_user_id = auth.uid()
);

-- 4) Tighten employees table - admin only + self view
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;

-- Admin full access
CREATE POLICY "Admin manages employees"
ON public.employees
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employee can only view their own record (matched by email)
CREATE POLICY "Employee views own record"
ON public.employees
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

-- 5) Tighten technicians table - admin/employee manage, technician views own
DROP POLICY IF EXISTS "Admins can manage technicians" ON public.technicians;
DROP POLICY IF EXISTS "Staff can read technicians" ON public.technicians;
DROP POLICY IF EXISTS "Technicians can view their own record" ON public.technicians;
DROP POLICY IF EXISTS "Technicians can update login attempts" ON public.technicians;

-- Admin full access
CREATE POLICY "Admin manages technicians"
ON public.technicians
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employees can read technicians for assignment purposes
CREATE POLICY "Employee reads technicians"
ON public.technicians
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

-- Technician can view only their own record
CREATE POLICY "Technician views own record"
ON public.technicians
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Technician can update their own login tracking fields
CREATE POLICY "Technician updates own login"
ON public.technicians
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6) Ensure profiles table is strictly owner + staff
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Employees can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Technicians can view limited profile info" ON public.profiles;

-- Admin full access
CREATE POLICY "Admin manages profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employee can read all profiles (needed for client lookups)
CREATE POLICY "Employee reads profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

-- Client can read and update only their own profile
CREATE POLICY "Client reads own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Client updates own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Client can insert their own profile (for signup)
CREATE POLICY "Client inserts own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Technicians can view limited profile info for assigned work
CREATE POLICY "Technician views assigned client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'technician'::app_role) AND
  user_id IN (
    SELECT o.user_id FROM public.orders o
    JOIN public.work_orders wo ON wo.linked_order_id = o.id
    JOIN public.technicians t ON wo.assigned_technician_id = t.id
    WHERE t.user_id = auth.uid()
  )
);

-- 7) Payment methods - strictly owner + admin
DROP POLICY IF EXISTS "Users can view their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can manage their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;

-- Admin full access
CREATE POLICY "Admin manages payment methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Client can manage only their own payment methods
CREATE POLICY "Client manages own payment methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
