-- Fix admin ability to approve/reject/pay influencer cashout requests
-- Root cause: cashout_requests admin policy relied only on user_roles via has_role(),
-- while admins are identified via admin_users (is_admin()).

BEGIN;

-- cashout_requests
DROP POLICY IF EXISTS "Admin can manage cashouts" ON public.cashout_requests;
CREATE POLICY "Admin can manage cashouts"
ON public.cashout_requests
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
)
WITH CHECK (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- influencer_payouts (needed when marking a cashout as paid)
DROP POLICY IF EXISTS "Admin can manage payouts" ON public.influencer_payouts;
CREATE POLICY "Admin can manage payouts"
ON public.influencer_payouts
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
)
WITH CHECK (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- referral_program_settings (admin pages may edit settings)
DROP POLICY IF EXISTS "Admin can manage settings" ON public.referral_program_settings;
CREATE POLICY "Admin can manage settings"
ON public.referral_program_settings
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
)
WITH CHECK (
  public.is_admin()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

COMMIT;