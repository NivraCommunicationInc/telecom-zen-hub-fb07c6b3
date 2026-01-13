-- Fix admin referral management: ensure admins (user_roles=admin) can SELECT/INSERT/UPDATE/DELETE
-- influencer program tables. Previous policies relied on admin_users and/or lacked WITH CHECK
-- which caused updates/inserts to silently fail under RLS.

-- NOTE: We do NOT remove influencer self-service policies; we only add explicit admin policies.

DO $$
BEGIN
  -- influencers
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='influencers' AND policyname='Admins can manage influencers') THEN
    EXECUTE 'DROP POLICY "Admins can manage influencers" ON public.influencers';
  END IF;

  -- referral_codes
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_codes' AND policyname='Admins can manage referral_codes') THEN
    EXECUTE 'DROP POLICY "Admins can manage referral_codes" ON public.referral_codes';
  END IF;

  -- referral_attributions
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_attributions' AND policyname='Admins can manage referral_attributions') THEN
    EXECUTE 'DROP POLICY "Admins can manage referral_attributions" ON public.referral_attributions';
  END IF;

  -- commission_ledger_entries
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='commission_ledger_entries' AND policyname='Admins can manage commission_ledger_entries') THEN
    EXECUTE 'DROP POLICY "Admins can manage commission_ledger_entries" ON public.commission_ledger_entries';
  END IF;

  -- cashout_requests
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cashout_requests' AND policyname='Admins can manage cashout_requests') THEN
    EXECUTE 'DROP POLICY "Admins can manage cashout_requests" ON public.cashout_requests';
  END IF;

  -- influencer_payouts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='influencer_payouts' AND policyname='Admins can manage influencer_payouts') THEN
    EXECUTE 'DROP POLICY "Admins can manage influencer_payouts" ON public.influencer_payouts';
  END IF;

  -- commission_plans (needed for dropdowns)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='commission_plans' AND policyname='Admins can manage commission_plans') THEN
    EXECUTE 'DROP POLICY "Admins can manage commission_plans" ON public.commission_plans';
  END IF;

  -- referral_program_settings (used by settings UI)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_program_settings' AND policyname='Admins can manage referral_program_settings') THEN
    EXECUTE 'DROP POLICY "Admins can manage referral_program_settings" ON public.referral_program_settings';
  END IF;
END $$;

-- Admin full-access policies (must include WITH CHECK so updates/inserts work)
CREATE POLICY "Admins can manage influencers"
ON public.influencers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referral_codes"
ON public.referral_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referral_attributions"
ON public.referral_attributions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage commission_ledger_entries"
ON public.commission_ledger_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage cashout_requests"
ON public.cashout_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage influencer_payouts"
ON public.influencer_payouts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage commission_plans"
ON public.commission_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referral_program_settings"
ON public.referral_program_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
