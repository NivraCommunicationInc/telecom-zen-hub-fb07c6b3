-- =====================================================
-- REFERRAL PARTNER PROGRAM - COMPLETE SCHEMA
-- =====================================================

-- 1. Commission Plan Type Enum
CREATE TYPE public.commission_model_type AS ENUM ('activation_fee', 'fixed_bounty', 'percent_first_invoice');

-- 2. Influencer Status Enum  
CREATE TYPE public.influencer_status AS ENUM ('invited', 'active', 'suspended');

-- 3. Commission Ledger Entry Type Enum
CREATE TYPE public.commission_ledger_type AS ENUM ('pending_credit', 'approved_credit', 'reversal', 'payout_debit', 'manual_adjustment');

-- 4. Cashout Status Enum
CREATE TYPE public.cashout_status AS ENUM ('requested', 'under_review', 'approved', 'rejected', 'paid');

-- 5. Fraud Flag Level Enum
CREATE TYPE public.fraud_flag_level AS ENUM ('none', 'low', 'medium', 'high');

-- =====================================================
-- PROGRAM SETTINGS (Single Row Configuration)
-- =====================================================
CREATE TABLE public.referral_program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_percent_first_invoice_monthly INTEGER NOT NULL DEFAULT 50,
  discount_stacks BOOLEAN NOT NULL DEFAULT false,
  commission_model_default public.commission_model_type NOT NULL DEFAULT 'fixed_bounty',
  commission_value_default NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  cooldown_days INTEGER NOT NULL DEFAULT 14,
  min_cashout_amount NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  allow_self_referrals BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.referral_program_settings (id) VALUES (gen_random_uuid());

-- =====================================================
-- COMMISSION PLANS
-- =====================================================
CREATE TABLE public.commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  model public.commission_model_type NOT NULL DEFAULT 'fixed_bounty',
  value NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default commission plan
INSERT INTO public.commission_plans (name, description, model, value, is_default)
VALUES ('Standard Partner Plan', 'Default $25 fixed bounty per activated customer', 'fixed_bounty', 25.00, true);

-- =====================================================
-- INFLUENCERS
-- =====================================================
CREATE TABLE public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  status public.influencer_status NOT NULL DEFAULT 'invited',
  commission_plan_id UUID REFERENCES public.commission_plans(id),
  payout_email TEXT,
  payout_method TEXT DEFAULT 'etransfer',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INFLUENCER INVITES
-- =====================================================
CREATE TABLE public.influencer_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- REFERRAL CODES
-- =====================================================
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  usage_limit_total INTEGER,
  usage_limit_monthly INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast code lookups
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX idx_referral_codes_influencer ON public.referral_codes(influencer_id);

-- =====================================================
-- REFERRAL ATTRIBUTIONS
-- =====================================================
CREATE TABLE public.referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  customer_email TEXT,
  order_id UUID,
  invoice_id UUID,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id),
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'first_invoice_monthly_50',
  fraud_flag_level public.fraud_flag_level NOT NULL DEFAULT 'none',
  fraud_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reversed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_referral_attributions_customer ON public.referral_attributions(customer_id);
CREATE INDEX idx_referral_attributions_influencer ON public.referral_attributions(influencer_id);
CREATE INDEX idx_referral_attributions_order ON public.referral_attributions(order_id);

-- =====================================================
-- COMMISSION LEDGER ENTRIES
-- =====================================================
CREATE TABLE public.commission_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES public.referral_attributions(id),
  invoice_id UUID,
  type public.commission_ledger_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reversed', 'paid')),
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for balance calculations
CREATE INDEX idx_commission_ledger_influencer ON public.commission_ledger_entries(influencer_id);
CREATE INDEX idx_commission_ledger_status ON public.commission_ledger_entries(status);

-- =====================================================
-- CASHOUT REQUESTS
-- =====================================================
CREATE TABLE public.cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'etransfer' CHECK (method IN ('etransfer', 'bank')),
  destination TEXT NOT NULL,
  status public.cashout_status NOT NULL DEFAULT 'requested',
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generate request number
CREATE OR REPLACE FUNCTION public.generate_cashout_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'CR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(COUNT(*) + 1, 1)::TEXT FROM public.cashout_requests 
     WHERE created_at::date = CURRENT_DATE), 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cashout_request_number
BEFORE INSERT ON public.cashout_requests
FOR EACH ROW
WHEN (NEW.request_number IS NULL)
EXECUTE FUNCTION public.generate_cashout_request_number();

-- =====================================================
-- PAYOUTS
-- =====================================================
CREATE TABLE public.influencer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  cashout_request_id UUID REFERENCES public.cashout_requests(id),
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL,
  reference_id TEXT,
  notes TEXT,
  paid_by UUID,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INFLUENCER AUDIT LOG
-- =====================================================
CREATE TABLE public.influencer_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- CUSTOMER REFERRAL USAGE (Prevent multiple uses)
-- =====================================================
CREATE TABLE public.customer_referral_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  customer_email TEXT NOT NULL,
  attribution_id UUID NOT NULL REFERENCES public.referral_attributions(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.referral_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referral_usage ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Check if user is influencer
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_influencer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.influencers
    WHERE user_id = _user_id AND status = 'active'
  )
$$;

-- =====================================================
-- HELPER FUNCTION: Get influencer ID for user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_influencer_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.influencers
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

-- =====================================================
-- RLS POLICIES - ADMIN ACCESS (uses existing has_role)
-- =====================================================

-- Settings: Admin/Employee only
CREATE POLICY "Admin can manage settings" ON public.referral_program_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Commission Plans: Admin/Employee full, Influencers read
CREATE POLICY "Admin can manage commission plans" ON public.commission_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view commission plans" ON public.commission_plans
  FOR SELECT TO authenticated
  USING (public.is_influencer(auth.uid()));

-- Influencers: Admin/Employee manage, Influencer own profile
CREATE POLICY "Admin can manage influencers" ON public.influencers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own profile" ON public.influencers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Influencers can update own profile" ON public.influencers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Invites: Admin/Employee only
CREATE POLICY "Admin can manage invites" ON public.influencer_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Allow public token validation (for onboarding)
CREATE POLICY "Public can validate invite tokens" ON public.influencer_invites
  FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());

-- Referral Codes: Admin/Employee manage, Influencer own codes
CREATE POLICY "Admin can manage referral codes" ON public.referral_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own codes" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

-- Public code validation
CREATE POLICY "Public can validate codes" ON public.referral_codes
  FOR SELECT TO anon
  USING (status = 'active');

-- Attributions: Admin/Employee full, Influencer own (masked in app layer)
CREATE POLICY "Admin can manage attributions" ON public.referral_attributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own attributions" ON public.referral_attributions
  FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

-- Commission Ledger: Admin/Employee manage, Influencer view own
CREATE POLICY "Admin can manage ledger" ON public.commission_ledger_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own ledger" ON public.commission_ledger_entries
  FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

-- Cashout Requests: Admin/Employee manage, Influencer own
CREATE POLICY "Admin can manage cashouts" ON public.cashout_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own cashouts" ON public.cashout_requests
  FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

CREATE POLICY "Influencers can create cashout requests" ON public.cashout_requests
  FOR INSERT TO authenticated
  WITH CHECK (influencer_id = public.get_influencer_id(auth.uid()));

-- Payouts: Admin/Employee manage, Influencer view own
CREATE POLICY "Admin can manage payouts" ON public.influencer_payouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Influencers can view own payouts" ON public.influencer_payouts
  FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

-- Audit Log: Admin/Employee only
CREATE POLICY "Admin can view audit log" ON public.influencer_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Admin can insert audit log" ON public.influencer_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Customer Usage: Service role only (managed by backend)
CREATE POLICY "Service can manage customer usage" ON public.customer_referral_usage
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- =====================================================
-- UPDATE TIMESTAMP TRIGGERS
-- =====================================================
CREATE TRIGGER update_referral_program_settings_updated_at
  BEFORE UPDATE ON public.referral_program_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_attributions_updated_at
  BEFORE UPDATE ON public.referral_attributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cashout_requests_updated_at
  BEFORE UPDATE ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ADD INFLUENCER ROLE TO APP_ROLE ENUM
-- =====================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'influencer';