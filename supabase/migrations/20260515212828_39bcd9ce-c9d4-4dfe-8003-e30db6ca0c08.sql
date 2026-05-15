-- FIX 1 — Allow field agents (and staff) to insert into field_commissions.
-- Reads were already permitted; INSERT was missing, so the client-side
-- insert in FieldNewSale.tsx silently failed (RLS denied) and dashboards
-- always showed 0 ventes / 0 commissions.

DROP POLICY IF EXISTS "Agents insert own commissions" ON public.field_commissions;
CREATE POLICY "Agents insert own commissions"
  ON public.field_commissions
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "Staff insert any commission" ON public.field_commissions;
CREATE POLICY "Staff insert any commission"
  ON public.field_commissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.status = 'active'
        AND user_roles.is_active = true
        AND (user_roles.can_access_core = true OR user_roles.can_access_employee = true)
    )
  );

-- Staff/admins also need to be able to update commissions (approve / pay / clawback).
DROP POLICY IF EXISTS "Staff update commissions" ON public.field_commissions;
CREATE POLICY "Staff update commissions"
  ON public.field_commissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.status = 'active'
        AND user_roles.is_active = true
        AND (user_roles.can_access_core = true OR user_roles.can_access_employee = true)
    )
  )
  WITH CHECK (true);