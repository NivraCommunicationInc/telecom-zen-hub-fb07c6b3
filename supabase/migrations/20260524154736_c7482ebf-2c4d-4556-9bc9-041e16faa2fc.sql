-- Ajouter des politiques RLS pour billing_admin et supervisor sur les tables de paie
-- Vérifier si la politique existe déjà, sinon la créer

DO $$
BEGIN
  -- payroll_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payroll_entries' AND policyname = 'Billing admin manages payroll_entries') THEN
    CREATE POLICY "Billing admin manages payroll_entries"
    ON public.payroll_entries
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- payroll_payments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payroll_payments' AND policyname = 'Billing admin manages payroll_payments') THEN
    CREATE POLICY "Billing admin manages payroll_payments"
    ON public.payroll_payments
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- time_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'time_entries' AND policyname = 'Billing admin manages time_entries') THEN
    CREATE POLICY "Billing admin manages time_entries"
    ON public.time_entries
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- pay_periods
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pay_periods' AND policyname = 'Billing admin manages pay_periods') THEN
    CREATE POLICY "Billing admin manages pay_periods"
    ON public.pay_periods
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- payroll_adjustments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payroll_adjustments' AND policyname = 'Billing admin manages payroll_adjustments') THEN
    CREATE POLICY "Billing admin manages payroll_adjustments"
    ON public.payroll_adjustments
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- pay_adjustments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pay_adjustments' AND policyname = 'Billing admin manages pay_adjustments') THEN
    CREATE POLICY "Billing admin manages pay_adjustments"
    ON public.pay_adjustments
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;

  -- employee_payroll_settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_payroll_settings' AND policyname = 'Billing admin manages employee_payroll_settings') THEN
    CREATE POLICY "Billing admin manages employee_payroll_settings"
    ON public.employee_payroll_settings
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'billing_admin'::public.app_role) OR public.has_role(auth.uid(), 'supervisor'::public.app_role));
  END IF;
END $$;