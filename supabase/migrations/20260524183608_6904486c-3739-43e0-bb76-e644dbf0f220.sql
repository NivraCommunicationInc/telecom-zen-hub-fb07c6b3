
-- Mobile top-ups (recharges prépayées)
CREATE TABLE IF NOT EXISTS public.mobile_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  msisdn text,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'CAD',
  payment_method text NOT NULL DEFAULT 'manual',
  payment_reference text,
  status text NOT NULL DEFAULT 'completed',
  performed_by uuid NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_topups_user ON public.mobile_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_topups_account ON public.mobile_topups(account_id);
CREATE INDEX IF NOT EXISTS idx_mobile_topups_subscription ON public.mobile_topups(subscription_id);

ALTER TABLE public.mobile_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anonymous topups access" ON public.mobile_topups
  FOR ALL TO anon USING (false);

CREATE POLICY "Clients view own topups" ON public.mobile_topups
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage topups" ON public.mobile_topups
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  );

-- Mobile add-ons (options data, international, longue distance)
CREATE TABLE IF NOT EXISTS public.mobile_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  addon_code text NOT NULL,
  addon_name text NOT NULL,
  addon_type text NOT NULL CHECK (addon_type IN ('data','international','long_distance','roaming','voicemail','other')),
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  one_time_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','pending')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_reason text,
  activated_by uuid NOT NULL,
  cancelled_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_addons_user ON public.mobile_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_addons_subscription ON public.mobile_addons(subscription_id);
CREATE INDEX IF NOT EXISTS idx_mobile_addons_status ON public.mobile_addons(status);

ALTER TABLE public.mobile_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anonymous addons access" ON public.mobile_addons
  FOR ALL TO anon USING (false);

CREATE POLICY "Clients view own addons" ON public.mobile_addons
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage addons" ON public.mobile_addons
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  );

CREATE OR REPLACE FUNCTION public.touch_mobile_addons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mobile_addons_updated_at ON public.mobile_addons;
CREATE TRIGGER trg_mobile_addons_updated_at
  BEFORE UPDATE ON public.mobile_addons
  FOR EACH ROW EXECUTE FUNCTION public.touch_mobile_addons_updated_at();

-- SIM actions (suspend/reactivate/replace/swap-esim)
CREATE TABLE IF NOT EXISTS public.sim_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  mobile_fulfillment_id uuid REFERENCES public.mobile_fulfillment(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'suspend_lost','suspend_stolen','suspend_other','reactivate',
    'replace_sim','swap_to_esim','swap_to_physical',
    'block_international','unblock_international','block_roaming','unblock_roaming'
  )),
  reason text,
  old_iccid text,
  new_iccid text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','cancelled')),
  performed_by uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_actions_user ON public.sim_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_sim_actions_subscription ON public.sim_actions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sim_actions_type ON public.sim_actions(action_type);

ALTER TABLE public.sim_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anonymous sim actions access" ON public.sim_actions
  FOR ALL TO anon USING (false);

CREATE POLICY "Clients view own sim actions" ON public.sim_actions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage sim actions" ON public.sim_actions
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'support'::app_role) OR
    has_role(auth.uid(),'billing_admin'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  );
