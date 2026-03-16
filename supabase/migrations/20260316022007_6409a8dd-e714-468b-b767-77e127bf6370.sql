
-- =============================================
-- NIVRA CORE: Canonical Client Referral System
-- =============================================

-- 1. Add referral_code to profiles (auto-generated, unique, stable)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Create enum for referral lifecycle
DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM (
    'code_used',
    'order_created',
    'service_activated',
    'cycle_1_paid',
    'cycle_2_paid',
    'cycle_3_paid',
    'qualified',
    'reward_pending',
    'reward_issued',
    'cancelled',
    'disqualified',
    'fraud_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_reward_status AS ENUM (
    'not_eligible',
    'in_progress',
    'qualified',
    'reward_pending',
    'reward_issued',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Canonical client_referrals table
CREATE TABLE IF NOT EXISTS public.client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_used TEXT NOT NULL,
  
  -- Referrer (the client who shared the code)
  referrer_user_id UUID NOT NULL,
  referrer_account_id UUID REFERENCES public.accounts(id),
  referrer_billing_customer_id UUID,
  
  -- Referred (the new client)
  referred_user_id UUID NOT NULL,
  referred_account_id UUID REFERENCES public.accounts(id),
  referred_order_id UUID REFERENCES public.orders(id),
  referred_subscription_id UUID,
  referred_billing_customer_id UUID,
  
  -- Lifecycle
  status public.referral_status NOT NULL DEFAULT 'code_used',
  qualifying_cycles_paid INT NOT NULL DEFAULT 0,
  required_cycles INT NOT NULL DEFAULT 3,
  
  -- Reward
  reward_status public.referral_reward_status NOT NULL DEFAULT 'not_eligible',
  reward_type TEXT DEFAULT 'visa_mastercard_gift_card',
  reward_amount NUMERIC(10,2) DEFAULT 25.00,
  reward_issued_at TIMESTAMPTZ,
  reward_issued_by UUID,
  reward_reference TEXT,
  
  -- Qualification timestamps
  qualified_at TIMESTAMPTZ,
  disqualified_at TIMESTAMPTZ,
  disqualification_reason TEXT,
  
  -- Anti-fraud
  fraud_flag BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_review_notes TEXT,
  fraud_checked_at TIMESTAMPTZ,
  fraud_checked_by UUID,
  
  -- Audit
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate referrals for same referred user
  UNIQUE(referred_user_id)
);

-- 4. Referral audit/timeline log
CREATE TABLE IF NOT EXISTS public.client_referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.client_referrals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details JSONB,
  actor_id UUID,
  actor_type TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Auto-generate referral codes for profiles
CREATE OR REPLACE FUNCTION public.fn_generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_first TEXT;
  v_last TEXT;
BEGIN
  -- Only generate if referral_code is null
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  v_first := UPPER(COALESCE(LEFT(REGEXP_REPLACE(NEW.first_name, '[^a-zA-Z]', '', 'g'), 3), 'NIV'));
  v_last := UPPER(COALESCE(LEFT(REGEXP_REPLACE(NEW.last_name, '[^a-zA-Z]', '', 'g'), 3), 'RA'));
  
  -- Generate unique code: PREFIX + random suffix
  LOOP
    v_code := v_first || v_last || '-' || UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 5));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_referral_code ON public.profiles;
CREATE TRIGGER trg_auto_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.fn_generate_referral_code();

-- 6. Backfill existing profiles that have no referral code
UPDATE public.profiles SET referral_code = NULL WHERE referral_code IS NULL;

-- 7. Anti-fraud: function to validate referral at checkout
CREATE OR REPLACE FUNCTION public.fn_validate_client_referral(
  p_referral_code TEXT,
  p_referred_user_id UUID,
  p_referred_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer RECORD;
  v_result JSONB;
BEGIN
  -- Find referrer by code
  SELECT user_id, email, phone, first_name, last_name
  INTO v_referrer
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code));
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Code de parrainage invalide');
  END IF;
  
  -- Anti-fraud: self-referral
  IF v_referrer.user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Auto-parrainage interdit');
  END IF;
  
  -- Anti-fraud: same email
  IF LOWER(v_referrer.email) = LOWER(p_referred_email) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Même adresse courriel détectée');
  END IF;
  
  -- Anti-fraud: referred user already has a referral
  IF EXISTS (SELECT 1 FROM public.client_referrals WHERE referred_user_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Vous avez déjà utilisé un code de parrainage');
  END IF;
  
  -- Anti-fraud: same phone
  IF v_referrer.phone IS NOT NULL AND v_referrer.phone != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = p_referred_user_id 
      AND phone IS NOT NULL 
      AND phone = v_referrer.phone
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Même numéro de téléphone détecté');
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'referrer_user_id', v_referrer.user_id,
    'referrer_name', COALESCE(v_referrer.first_name, '') || ' ' || COALESCE(v_referrer.last_name, '')
  );
END;
$$;

-- 8. Qualification check function — called by billing cycle
CREATE OR REPLACE FUNCTION public.fn_check_referral_qualification(
  p_referral_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
  v_paid_count INT;
  v_sub_status TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.client_referrals WHERE id = p_referral_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  -- Skip if already terminal
  IF v_ref.status IN ('qualified', 'reward_pending', 'reward_issued', 'cancelled', 'disqualified') THEN
    RETURN;
  END IF;
  
  -- Check subscription status
  IF v_ref.referred_subscription_id IS NOT NULL THEN
    SELECT status INTO v_sub_status FROM public.subscriptions WHERE id = v_ref.referred_subscription_id;
    IF v_sub_status IN ('cancelled', 'expired') THEN
      UPDATE public.client_referrals
      SET status = 'cancelled', reward_status = 'cancelled',
          disqualified_at = now(), disqualification_reason = 'Abonnement annulé/expiré',
          updated_at = now()
      WHERE id = p_referral_id;
      
      INSERT INTO public.client_referral_events (referral_id, event_type, old_status, new_status, details)
      VALUES (p_referral_id, 'status_change', v_ref.status::TEXT, 'cancelled',
              jsonb_build_object('reason', 'Subscription cancelled/expired'));
      RETURN;
    END IF;
  END IF;
  
  -- Count paid qualifying invoices for the referred subscription
  SELECT COUNT(*) INTO v_paid_count
  FROM public.billing_invoices bi
  WHERE bi.subscription_id = v_ref.referred_subscription_id
    AND bi.type = 'renewal'
    AND bi.status = 'paid';
  
  -- Update cycle count
  UPDATE public.client_referrals
  SET qualifying_cycles_paid = v_paid_count,
      status = CASE
        WHEN v_paid_count >= 3 THEN 'qualified'::public.referral_status
        WHEN v_paid_count = 2 THEN 'cycle_2_paid'::public.referral_status
        WHEN v_paid_count = 1 THEN 'cycle_1_paid'::public.referral_status
        ELSE v_ref.status
      END,
      reward_status = CASE
        WHEN v_paid_count >= 3 THEN 'reward_pending'::public.referral_reward_status
        WHEN v_paid_count >= 1 THEN 'in_progress'::public.referral_reward_status
        ELSE v_ref.reward_status
      END,
      qualified_at = CASE WHEN v_paid_count >= 3 AND v_ref.qualified_at IS NULL THEN now() ELSE v_ref.qualified_at END,
      updated_at = now()
  WHERE id = p_referral_id;
  
  -- Log event if status changed
  IF v_paid_count >= 1 THEN
    INSERT INTO public.client_referral_events (referral_id, event_type, new_status, details)
    VALUES (p_referral_id, 'qualification_progress', 
            CASE WHEN v_paid_count >= 3 THEN 'qualified' WHEN v_paid_count = 2 THEN 'cycle_2_paid' ELSE 'cycle_1_paid' END,
            jsonb_build_object('paid_cycles', v_paid_count));
  END IF;
END;
$$;

-- 9. Trigger on billing_invoices to auto-check qualification when invoice is paid
CREATE OR REPLACE FUNCTION public.fn_referral_on_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_id UUID;
BEGIN
  -- Only fire when status changes to 'paid' and it's a renewal invoice
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') AND NEW.type = 'renewal' THEN
    -- Find referral linked to this subscription
    SELECT id INTO v_referral_id
    FROM public.client_referrals
    WHERE referred_subscription_id = NEW.subscription_id
      AND status NOT IN ('cancelled', 'disqualified', 'qualified', 'reward_pending', 'reward_issued');
    
    IF v_referral_id IS NOT NULL THEN
      PERFORM public.fn_check_referral_qualification(v_referral_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_invoice_paid ON public.billing_invoices;
CREATE TRIGGER trg_referral_invoice_paid
  AFTER UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_referral_on_invoice_paid();

-- 10. RLS Policies
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_referral_events ENABLE ROW LEVEL SECURITY;

-- Clients can see their own referrals (as referrer or referred)
CREATE POLICY "clients_view_own_referrals" ON public.client_referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- Admin/employee full access
CREATE POLICY "staff_manage_referrals" ON public.client_referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'supervisor'));

-- Events: clients view their own referral events
CREATE POLICY "clients_view_own_referral_events" ON public.client_referral_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_referrals cr
      WHERE cr.id = client_referral_events.referral_id
      AND (cr.referrer_user_id = auth.uid() OR cr.referred_user_id = auth.uid())
    )
  );

-- Events: staff full access
CREATE POLICY "staff_manage_referral_events" ON public.client_referral_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'supervisor'));

-- Clients can insert referrals (during checkout)
CREATE POLICY "clients_create_referrals" ON public.client_referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON public.client_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_client_referrals_referred ON public.client_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_client_referrals_status ON public.client_referrals(status);
CREATE INDEX IF NOT EXISTS idx_client_referrals_reward ON public.client_referrals(reward_status);
CREATE INDEX IF NOT EXISTS idx_client_referrals_code ON public.client_referrals(referral_code_used);
CREATE INDEX IF NOT EXISTS idx_client_referral_events_referral ON public.client_referral_events(referral_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
