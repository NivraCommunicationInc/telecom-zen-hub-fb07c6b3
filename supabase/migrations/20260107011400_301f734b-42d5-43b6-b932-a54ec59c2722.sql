-- Update RLS policies to grant employee admin-equivalent access

-- 1. BILLING: Add policy for staff (admin/employee) to update billing records
DROP POLICY IF EXISTS "Staff can update billing" ON public.billing;
CREATE POLICY "Staff can update billing"
ON public.billing
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- 2. SUPPORT_TICKETS: Update to include employee in management policy
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Staff can manage all tickets"
ON public.support_tickets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- Add SELECT policy for staff
DROP POLICY IF EXISTS "Staff can view all tickets" ON public.support_tickets;
CREATE POLICY "Staff can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- 3. TICKET_REPLIES: Update to include employee
DROP POLICY IF EXISTS "Admins can manage all replies" ON public.ticket_replies;
CREATE POLICY "Staff can manage all replies"
ON public.ticket_replies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- Add SELECT policy for staff to view all replies
DROP POLICY IF EXISTS "Staff can view all replies" ON public.ticket_replies;
CREATE POLICY "Staff can view all replies"
ON public.ticket_replies
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));