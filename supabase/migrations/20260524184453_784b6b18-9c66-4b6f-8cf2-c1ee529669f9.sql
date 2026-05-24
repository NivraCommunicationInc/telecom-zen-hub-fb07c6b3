-- ============================================================
-- Phase 2 — TV account management tables
-- ============================================================

-- ---- tv_plan_changes ----
CREATE TABLE IF NOT EXISTS public.tv_plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  previous_plan_name text,
  previous_monthly_price numeric(10,2),
  new_plan_name text NOT NULL,
  new_monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  change_type text NOT NULL DEFAULT 'upgrade',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  reason text,
  performed_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_plan_changes_change_type_chk
    CHECK (change_type IN ('upgrade','downgrade','lateral','reactivation','cancellation')),
  CONSTRAINT tv_plan_changes_status_chk
    CHECK (status IN ('pending','completed','cancelled','failed'))
);
CREATE INDEX IF NOT EXISTS idx_tv_plan_changes_user ON public.tv_plan_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_tv_plan_changes_subscription ON public.tv_plan_changes(subscription_id);

-- ---- tv_addon_subscriptions ----
CREATE TABLE IF NOT EXISTS public.tv_addon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  addon_code text NOT NULL,
  addon_name text NOT NULL,
  addon_type text NOT NULL DEFAULT 'themed_pack',
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancelled_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_addon_subs_type_chk
    CHECK (addon_type IN ('themed_pack','sports','cinema','international','adult','kids','premium_channel','other')),
  CONSTRAINT tv_addon_subs_status_chk
    CHECK (status IN ('active','cancelled','suspended'))
);
CREATE INDEX IF NOT EXISTS idx_tv_addon_subs_user_status ON public.tv_addon_subscriptions(user_id, status);

-- ---- tv_vod_purchases ----
CREATE TABLE IF NOT EXISTS public.tv_vod_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'movie',
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  payment_method text DEFAULT 'on_invoice',
  payment_reference text,
  status text NOT NULL DEFAULT 'completed',
  performed_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_vod_status_chk
    CHECK (status IN ('completed','refunded','failed')),
  CONSTRAINT tv_vod_content_chk
    CHECK (content_type IN ('movie','event','ppv','series','rental'))
);
CREATE INDEX IF NOT EXISTS idx_tv_vod_user ON public.tv_vod_purchases(user_id);

-- ---- tv_terminal_actions ----
CREATE TABLE IF NOT EXISTS public.tv_terminal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  terminal_serial text,
  action_type text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'completed',
  performed_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_terminal_action_chk
    CHECK (action_type IN ('reboot','identify','factory_reset','firmware_push','deactivate','reactivate')),
  CONSTRAINT tv_terminal_status_chk
    CHECK (status IN ('pending','completed','failed'))
);
CREATE INDEX IF NOT EXISTS idx_tv_terminal_user ON public.tv_terminal_actions(user_id);

-- ---- tv_parental_controls ----
CREATE TABLE IF NOT EXISTS public.tv_parental_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT false,
  pin_hash text,
  max_rating text DEFAULT 'PG-13',
  blocked_channels jsonb DEFAULT '[]'::jsonb,
  time_restrictions jsonb DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_parental_rating_chk
    CHECK (max_rating IN ('G','PG','PG-13','R','NC-17','adult_blocked'))
);

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_tv_plan_changes_updated ON public.tv_plan_changes;
CREATE TRIGGER trg_tv_plan_changes_updated BEFORE UPDATE ON public.tv_plan_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tv_addon_subs_updated ON public.tv_addon_subscriptions;
CREATE TRIGGER trg_tv_addon_subs_updated BEFORE UPDATE ON public.tv_addon_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tv_parental_updated ON public.tv_parental_controls;
CREATE TRIGGER trg_tv_parental_updated BEFORE UPDATE ON public.tv_parental_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.tv_plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_addon_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_vod_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_terminal_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_parental_controls ENABLE ROW LEVEL SECURITY;

-- Helper: any staff role
-- Using has_role per project standard

-- ---- tv_plan_changes policies ----
CREATE POLICY "tv_plan_changes_client_select"
  ON public.tv_plan_changes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tv_plan_changes_staff_all"
  ON public.tv_plan_changes FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  );

-- ---- tv_addon_subscriptions policies ----
CREATE POLICY "tv_addon_subs_client_select"
  ON public.tv_addon_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tv_addon_subs_staff_all"
  ON public.tv_addon_subscriptions FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  );

-- ---- tv_vod_purchases policies ----
CREATE POLICY "tv_vod_client_select"
  ON public.tv_vod_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tv_vod_staff_all"
  ON public.tv_vod_purchases FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  );

-- ---- tv_terminal_actions policies ----
CREATE POLICY "tv_terminal_client_select"
  ON public.tv_terminal_actions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tv_terminal_staff_all"
  ON public.tv_terminal_actions FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  );

-- ---- tv_parental_controls policies ----
CREATE POLICY "tv_parental_client_select"
  ON public.tv_parental_controls FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tv_parental_staff_all"
  ON public.tv_parental_controls FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR
    has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'support') OR
    has_role(auth.uid(),'billing_admin') OR has_role(auth.uid(),'sales')
  );