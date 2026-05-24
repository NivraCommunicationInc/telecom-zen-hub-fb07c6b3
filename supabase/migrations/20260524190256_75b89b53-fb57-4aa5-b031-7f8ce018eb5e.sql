
-- Phase 4: Billing account management tables (idempotent IF NOT EXISTS pattern)

-- ============================================================
-- 1. Payment methods
CREATE TABLE IF NOT EXISTS public.client_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  method_type TEXT NOT NULL,
  brand TEXT NULL,
  last4 TEXT NULL,
  exp_month INTEGER NULL,
  exp_year INTEGER NULL,
  holder_name TEXT NULL,
  paypal_email TEXT NULL,
  provider_token TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  added_by UUID NULL,
  removed_at TIMESTAMPTZ NULL,
  removed_by UUID NULL,
  removed_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_payment_methods_user
  ON public.client_payment_methods(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_payment_method_per_user
  ON public.client_payment_methods(user_id) WHERE is_default = true AND status = 'active';
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_pm_client_select" ON public.client_payment_methods;
CREATE POLICY "client_pm_client_select"
ON public.client_payment_methods FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_pm_staff_all" ON public.client_payment_methods;
CREATE POLICY "client_pm_staff_all"
ON public.client_payment_methods FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
);

DROP TRIGGER IF EXISTS trg_client_payment_methods_updated_at ON public.client_payment_methods;
CREATE TRIGGER trg_client_payment_methods_updated_at
BEFORE UPDATE ON public.client_payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Auto-pay settings
CREATE TABLE IF NOT EXISTS public.client_autopay_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  account_id UUID NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  payment_method_id UUID NULL REFERENCES public.client_payment_methods(id) ON DELETE SET NULL,
  charge_day_offset INTEGER NOT NULL DEFAULT 0,
  enabled_at TIMESTAMPTZ NULL,
  enabled_by UUID NULL,
  disabled_at TIMESTAMPTZ NULL,
  disabled_by UUID NULL,
  disabled_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_autopay_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_autopay_client_select" ON public.client_autopay_settings;
CREATE POLICY "client_autopay_client_select"
ON public.client_autopay_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_autopay_staff_all" ON public.client_autopay_settings;
CREATE POLICY "client_autopay_staff_all"
ON public.client_autopay_settings FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
);

DROP TRIGGER IF EXISTS trg_client_autopay_settings_updated_at ON public.client_autopay_settings;
CREATE TRIGGER trg_client_autopay_settings_updated_at
BEFORE UPDATE ON public.client_autopay_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Payment plans
CREATE TABLE IF NOT EXISTS public.client_payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  invoice_id UUID NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  installment_count INTEGER NOT NULL,
  installment_amount NUMERIC(10,2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  first_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reason TEXT NULL,
  approved_by UUID NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by UUID NULL,
  cancelled_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_payment_plans_user
  ON public.client_payment_plans(user_id, status);
ALTER TABLE public.client_payment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_plan_client_select" ON public.client_payment_plans;
CREATE POLICY "client_plan_client_select"
ON public.client_payment_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_plan_staff_all" ON public.client_payment_plans;
CREATE POLICY "client_plan_staff_all"
ON public.client_payment_plans FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'billing_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'billing_admin')
);

DROP POLICY IF EXISTS "client_plan_support_read" ON public.client_payment_plans;
CREATE POLICY "client_plan_support_read"
ON public.client_payment_plans FOR SELECT
USING (
  public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'support')
);

DROP TRIGGER IF EXISTS trg_client_payment_plans_updated_at ON public.client_payment_plans;
CREATE TRIGGER trg_client_payment_plans_updated_at
BEFORE UPDATE ON public.client_payment_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Billing settings (DIFFERENT name to avoid conflict with existing
-- client_billing_preferences which holds preauth discount opt-in data)
CREATE TABLE IF NOT EXISTS public.client_billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  account_id UUID NULL,
  billing_day_of_month INTEGER NOT NULL DEFAULT 1,
  delivery_format TEXT NOT NULL DEFAULT 'electronic',
  language TEXT NOT NULL DEFAULT 'fr',
  email_for_billing TEXT NULL,
  paper_mailing_address TEXT NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_bs_client_select" ON public.client_billing_settings;
CREATE POLICY "client_bs_client_select"
ON public.client_billing_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_bs_staff_all" ON public.client_billing_settings;
CREATE POLICY "client_bs_staff_all"
ON public.client_billing_settings FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
);

DROP TRIGGER IF EXISTS trg_client_billing_settings_updated_at ON public.client_billing_settings;
CREATE TRIGGER trg_client_billing_settings_updated_at
BEFORE UPDATE ON public.client_billing_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Direct refunds
CREATE TABLE IF NOT EXISTS public.client_direct_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  invoice_id UUID NULL,
  payment_id UUID NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  refund_method TEXT NOT NULL,
  external_reference TEXT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  rejected_reason TEXT NULL,
  processed_at TIMESTAMPTZ NULL,
  performed_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_direct_refunds_user
  ON public.client_direct_refunds(user_id, created_at DESC);
ALTER TABLE public.client_direct_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_refund_client_select" ON public.client_direct_refunds;
CREATE POLICY "client_refund_client_select"
ON public.client_direct_refunds FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_refund_staff_all" ON public.client_direct_refunds;
CREATE POLICY "client_refund_staff_all"
ON public.client_direct_refunds FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'billing_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'billing_admin')
);

DROP POLICY IF EXISTS "client_refund_support_read" ON public.client_direct_refunds;
CREATE POLICY "client_refund_support_read"
ON public.client_direct_refunds FOR SELECT
USING (
  public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'support')
);

DROP TRIGGER IF EXISTS trg_client_direct_refunds_updated_at ON public.client_direct_refunds;
CREATE TRIGGER trg_client_direct_refunds_updated_at
BEFORE UPDATE ON public.client_direct_refunds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
