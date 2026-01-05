
-- ============================================
-- LEDGER SYSTEM + E-TRANSFER PROOF FLOW
-- ============================================

-- Payment status enum for clear state management
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending',
    'authorized',
    'preauthorized', 
    'in_verification',
    'captured',
    'complete',
    'paid',
    'declined',
    'failed',
    'refunded',
    'fraud',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ledger entry type enum
DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM (
    'invoice',
    'payment',
    'credit',
    'adjustment',
    'refund',
    'late_fee',
    'promo_credit'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- LEDGER ENTRIES TABLE (Source of Truth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  entry_type ledger_entry_type NOT NULL,
  -- Positive = client owes money (debit/invoice)
  -- Negative = client credit (payment captured)
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  reference_type TEXT, -- 'billing', 'monthly_invoice', 'payment', 'order'
  reference_id UUID,
  reference_number TEXT,
  payment_method TEXT, -- 'card', 'etransfer', 'cash', 'cheque', 'wallet'
  payment_status TEXT, -- mirrors billing.status for payments
  captured_at TIMESTAMPTZ, -- only set when payment is captured/complete
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID,
  created_by_name TEXT,
  created_by_role TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Index for fast balance queries
CREATE INDEX IF NOT EXISTS idx_ledger_client_id ON public.ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_id ON public.ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON public.ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_captured ON public.ledger_entries(captured_at) WHERE captured_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view their own ledger entries" ON public.ledger_entries
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Staff can view all ledger entries" ON public.ledger_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

CREATE POLICY "Staff can insert ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

CREATE POLICY "Staff can update ledger entries" ON public.ledger_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

-- ============================================
-- PAYMENT PROOFS TABLE (e-Transfer evidence)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL, -- references billing.id
  client_id UUID NOT NULL,
  proof_type TEXT NOT NULL DEFAULT 'etransfer', -- 'etransfer', 'bank_transfer', 'cheque', 'other'
  file_url TEXT, -- uploaded proof image/pdf
  file_name TEXT,
  file_size INTEGER,
  -- Client-provided info
  sender_name TEXT,
  sender_bank TEXT,
  transfer_date DATE,
  transfer_amount NUMERIC(10,2),
  transfer_reference TEXT, -- Interac confirmation number
  notes TEXT,
  -- Verification
  verification_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'fraud'
  verified_at TIMESTAMPTZ,
  verified_by_id UUID,
  verified_by_name TEXT,
  verification_notes TEXT,
  auto_matched BOOLEAN DEFAULT false,
  match_confidence NUMERIC(3,2), -- 0.00 to 1.00
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proofs_payment ON public.payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_proofs_client ON public.payment_proofs(client_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON public.payment_proofs(verification_status);

-- Enable RLS
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view their own proofs" ON public.payment_proofs
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can insert their own proofs" ON public.payment_proofs
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Staff can view all proofs" ON public.payment_proofs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

CREATE POLICY "Staff can update proofs" ON public.payment_proofs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

-- ============================================
-- ADD COLUMNS TO BILLING TABLE
-- ============================================
ALTER TABLE public.billing 
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
  ADD COLUMN IF NOT EXISTS etransfer_reference TEXT,
  ADD COLUMN IF NOT EXISTS etransfer_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_preauthorized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preauthorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ledger_entry_id UUID;

-- ============================================
-- BALANCE CALCULATION FUNCTION (Ledger-based)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_client_ledger_balance(p_client_id UUID)
RETURNS TABLE(
  total_debits NUMERIC,
  total_credits NUMERIC,
  balance NUMERIC,
  available_credit NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_debits NUMERIC;
  v_credits NUMERIC;
  v_balance NUMERIC;
BEGIN
  -- Sum all debits (positive amounts - invoices/fees)
  SELECT COALESCE(SUM(amount), 0) INTO v_debits
  FROM public.ledger_entries
  WHERE client_id = p_client_id
    AND amount > 0;

  -- Sum all credits (negative amounts - captured payments only)
  -- Only count payments that are actually captured/complete
  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_credits
  FROM public.ledger_entries
  WHERE client_id = p_client_id
    AND amount < 0
    AND (
      captured_at IS NOT NULL 
      OR payment_status IN ('paid', 'complete', 'captured')
    );

  v_balance := v_debits - v_credits;

  RETURN QUERY SELECT 
    v_debits AS total_debits,
    v_credits AS total_credits,
    v_balance AS balance,
    CASE WHEN v_balance < 0 THEN ABS(v_balance) ELSE 0 END AS available_credit;
END;
$$;

-- ============================================
-- CHECK IF PAYMENT IS CAPTURED
-- ============================================
CREATE OR REPLACE FUNCTION public.is_payment_captured(p_status TEXT, p_captured_at TIMESTAMPTZ DEFAULT NULL, p_paid_at TIMESTAMPTZ DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- A payment is captured if:
  -- 1. Status is one of the captured statuses AND
  -- 2. Has a captured_at or paid_at timestamp
  RETURN (
    LOWER(COALESCE(p_status, '')) IN ('paid', 'complete', 'captured', 'settled')
    AND (p_captured_at IS NOT NULL OR p_paid_at IS NOT NULL)
  );
END;
$$;

-- ============================================
-- TRIGGER: Create ledger entry on billing insert/update
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_billing_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_is_captured BOOLEAN;
  v_entry_type ledger_entry_type;
BEGIN
  -- Determine if this is a captured payment
  v_is_captured := public.is_payment_captured(NEW.status, NEW.captured_at, NEW.paid_at);
  
  -- For invoices (billing records represent what client owes)
  IF TG_OP = 'INSERT' THEN
    -- Create debit entry for the invoice
    INSERT INTO public.ledger_entries (
      client_id, account_id, entry_type, amount, description,
      reference_type, reference_id, reference_number,
      payment_method, payment_status, created_at
    ) VALUES (
      NEW.user_id,
      NULL,
      'invoice'::ledger_entry_type,
      NEW.amount, -- Positive = client owes
      'Facture #' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
      'billing',
      NEW.id,
      NEW.invoice_number,
      NEW.payment_method,
      NEW.status,
      NEW.created_at
    ) RETURNING id INTO v_entry_id;
    
    -- Update billing with ledger entry reference
    NEW.ledger_entry_id := v_entry_id;
  END IF;
  
  -- When payment status changes to captured
  IF TG_OP = 'UPDATE' AND v_is_captured AND NOT public.is_payment_captured(OLD.status, OLD.captured_at, OLD.paid_at) THEN
    -- Create credit entry for the payment
    INSERT INTO public.ledger_entries (
      client_id, account_id, entry_type, amount, description,
      reference_type, reference_id, reference_number,
      payment_method, payment_status, captured_at, created_at
    ) VALUES (
      NEW.user_id,
      NULL,
      'payment'::ledger_entry_type,
      -COALESCE(NEW.amount_paid, NEW.amount), -- Negative = credit
      'Paiement - Facture #' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
      'billing',
      NEW.id,
      NEW.payment_reference,
      NEW.payment_method,
      NEW.status,
      COALESCE(NEW.captured_at, NEW.paid_at, now()),
      now()
    );
    
    -- Set captured_at if not already set
    IF NEW.captured_at IS NULL THEN
      NEW.captured_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trg_sync_billing_to_ledger ON public.billing;
CREATE TRIGGER trg_sync_billing_to_ledger
  BEFORE INSERT OR UPDATE ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_billing_to_ledger();

-- ============================================
-- GENERATE ETRANSFER REFERENCE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS etransfer_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_etransfer_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'NIVRA-PAY-QC-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('etransfer_ref_seq')::TEXT, 5, '0');
END;
$$;

-- ============================================
-- AUTO-VALIDATE ETRANSFER PROOF
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_validate_etransfer_proof()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing RECORD;
  v_confidence NUMERIC := 0;
  v_matched BOOLEAN := false;
BEGIN
  -- Get the related billing record
  SELECT * INTO v_billing FROM public.billing WHERE id = NEW.payment_id;
  
  IF v_billing IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Auto-matching logic
  -- Check amount match
  IF NEW.transfer_amount IS NOT NULL AND ABS(NEW.transfer_amount - v_billing.amount) < 0.01 THEN
    v_confidence := v_confidence + 0.4;
  END IF;
  
  -- Check reference match
  IF NEW.transfer_reference IS NOT NULL AND v_billing.etransfer_reference IS NOT NULL 
     AND LOWER(NEW.transfer_reference) LIKE '%' || LOWER(v_billing.etransfer_reference) || '%' THEN
    v_confidence := v_confidence + 0.3;
  END IF;
  
  -- Check date is recent (within 7 days)
  IF NEW.transfer_date IS NOT NULL AND NEW.transfer_date >= CURRENT_DATE - INTERVAL '7 days' THEN
    v_confidence := v_confidence + 0.2;
  END IF;
  
  -- Check sender name matches client profile
  IF NEW.sender_name IS NOT NULL THEN
    v_confidence := v_confidence + 0.1;
  END IF;
  
  NEW.match_confidence := v_confidence;
  
  -- If high confidence, auto-verify
  IF v_confidence >= 0.7 THEN
    NEW.auto_matched := true;
    NEW.verification_status := 'verified';
    NEW.verified_at := now();
    NEW.verification_notes := 'Auto-vérifié: confiance ' || ROUND(v_confidence * 100) || '%';
    
    -- Update billing status to complete
    UPDATE public.billing
    SET status = 'paid',
        paid_at = now(),
        captured_at = now(),
        etransfer_status = 'complete'
    WHERE id = NEW.payment_id;
  ELSE
    -- Mark as in_verification, needs manual review
    UPDATE public.billing
    SET etransfer_status = 'in_verification',
        proof_submitted_at = now()
    WHERE id = NEW.payment_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_validate_proof ON public.payment_proofs;
CREATE TRIGGER trg_auto_validate_proof
  BEFORE INSERT ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_validate_etransfer_proof();

-- ============================================
-- NOTIFICATION ON PROOF SUBMITTED
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_proof_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_ids UUID[];
  v_admin_id UUID;
  v_billing RECORD;
BEGIN
  -- Get billing info
  SELECT * INTO v_billing FROM public.billing WHERE id = NEW.payment_id;
  
  -- Get all admin users
  SELECT ARRAY_AGG(user_id) INTO v_admin_ids
  FROM public.user_roles WHERE role = 'admin';
  
  -- Notify each admin
  IF v_admin_ids IS NOT NULL THEN
    FOREACH v_admin_id IN ARRAY v_admin_ids LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'admin',
        'payment',
        'Preuve e-Transfer reçue',
        'Facture #' || COALESCE(v_billing.invoice_number, v_billing.id::TEXT) || ' - Vérification requise',
        '/admin/billing',
        NEW.payment_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_proof_submitted ON public.payment_proofs;
CREATE TRIGGER trg_notify_proof_submitted
  AFTER INSERT ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_proof_submitted();

-- ============================================
-- STORAGE BUCKET FOR PAYMENT PROOFS
-- ============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Clients can upload their own proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients can view their own proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Staff can view all payment proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

-- ============================================
-- ENABLE REALTIME FOR LEDGER
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_proofs;
