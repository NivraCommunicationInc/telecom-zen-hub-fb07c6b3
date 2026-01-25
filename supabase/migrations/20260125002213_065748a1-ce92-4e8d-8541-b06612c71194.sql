-- SEV0 HOTFIX: Tickets (create + reply) across Admin/Staff/Client
-- Goal: remove role-source mismatch (admin_users / staff_roles vs user_roles) that blocks inserts
-- and ensure legacy view public.tickets remains available.

-- 0) Ensure legacy compatibility view exists (harmless if already exists)
DROP VIEW IF EXISTS public.tickets CASCADE;
CREATE VIEW public.tickets
WITH (security_invoker = true) AS
SELECT * FROM public.support_tickets;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.tickets TO anon;

-- 1) Unify admin detection used by ticket policies
-- Existing is_admin() checked only admin_users; broaden to also accept is_admin_user()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  )
  OR public.is_admin_user();
$$;

-- 2) support_tickets: allow staff based on staff_roles (and admins) to view + insert
-- Keep existing policies; add missing ones to cover staff_roles users.
DROP POLICY IF EXISTS "staff_roles_can_view_all_tickets" ON public.support_tickets;
CREATE POLICY "staff_roles_can_view_all_tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "staff_roles_can_insert_tickets" ON public.support_tickets;
CREATE POLICY "staff_roles_can_insert_tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_staff_member(auth.uid()));

-- 3) ticket_replies: allow inserts/selects for admin_users + staff_roles
DROP POLICY IF EXISTS "admin_users_can_insert_replies" ON public.ticket_replies;
CREATE POLICY "admin_users_can_insert_replies"
  ON public.ticket_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS "staff_roles_can_insert_replies" ON public.ticket_replies;
CREATE POLICY "staff_roles_can_insert_replies"
  ON public.ticket_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_member(auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "staff_roles_can_view_all_replies" ON public.ticket_replies;
CREATE POLICY "staff_roles_can_view_all_replies"
  ON public.ticket_replies
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_staff_member(auth.uid()));
