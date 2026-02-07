-- ============================================================================
-- V2.6: IDEMPOTENCE, ANTI-SPAM, TOKENS SÉCURISÉS, MACHINE À ÉTATS
-- Contracts security hardening + email queue retry logic
-- ============================================================================

-- =========================================
-- 0. ADD MISSING updated_at COLUMN FIRST
-- =========================================
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- =========================================
-- 1. IDEMPOTENCE: UNIQUE constraint on contracts(order_id)
-- =========================================
-- First, void any duplicate contracts (keep the first one)
WITH ranked AS (
  SELECT id, order_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at ASC) as rn
  FROM public.contracts
  WHERE order_id IS NOT NULL AND status NOT IN ('void', 'superseded')
)
UPDATE public.contracts c
SET status = 'superseded'
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- Add unique partial index (only one active contract per order)
DROP INDEX IF EXISTS idx_contracts_unique_active_order;
CREATE UNIQUE INDEX idx_contracts_unique_active_order 
ON public.contracts(order_id) 
WHERE order_id IS NOT NULL AND status NOT IN ('void', 'superseded');

-- =========================================
-- 2. HARMONIZE PAYMENT CONFIRMATION: confirmed_at field
-- =========================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

-- Backfill existing confirmed orders
UPDATE public.orders 
SET payment_confirmed_at = COALESCE(updated_at, created_at)
WHERE payment_status IN ('captured', 'paid', 'confirmed')
  AND payment_confirmed_at IS NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_orders_payment_confirmed_at 
ON public.orders(payment_confirmed_at) 
WHERE payment_confirmed_at IS NOT NULL;

-- =========================================
-- 3. EMAIL QUEUE ANTI-SPAM IMPROVEMENTS
-- =========================================
ALTER TABLE public.email_queue
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Add idempotency key without unique constraint first (to handle existing duplicates)
ALTER TABLE public.email_queue
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Index for retry processing
CREATE INDEX IF NOT EXISTS idx_email_queue_retry 
ON public.email_queue(next_retry_at) 
WHERE status = 'pending' AND retry_count < 5;

-- Index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_idempotency 
ON public.email_queue(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- =========================================
-- 4. SIGNATURE TOKENS: Enhanced security
-- =========================================
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS signature_token_hash text,
ADD COLUMN IF NOT EXISTS signature_token_used_at timestamptz,
ADD COLUMN IF NOT EXISTS signature_token_role text,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add check constraint separately to avoid issues
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_signature_token_role_check'
  ) THEN
    ALTER TABLE public.contracts 
    ADD CONSTRAINT contracts_signature_token_role_check 
    CHECK (signature_token_role IS NULL OR signature_token_role IN ('client', 'admin'));
  END IF;
END $$;

-- Index for token hash lookup
CREATE INDEX IF NOT EXISTS idx_contracts_token_hash 
ON public.contracts(signature_token_hash) 
WHERE signature_token_hash IS NOT NULL;

-- =========================================
-- 5. STATE MACHINE VALIDATION FUNCTION
-- =========================================
CREATE OR REPLACE FUNCTION public.validate_contract_status_transition(
  p_old_status text,
  p_new_status text
) RETURNS boolean AS $$
DECLARE
  v_allowed_transitions jsonb;
BEGIN
  v_allowed_transitions := jsonb_build_object(
    'draft', '["waiting_client_signature", "void"]'::jsonb,
    'waiting_client_signature', '["signed_by_client", "signed_by_admin", "void", "superseded"]'::jsonb,
    'signed_by_client', '["fully_signed", "void", "superseded"]'::jsonb,
    'signed_by_admin', '["fully_signed", "void", "superseded"]'::jsonb,
    'fully_signed', '["void", "superseded"]'::jsonb,
    'sent', '["waiting_client_signature", "void", "superseded"]'::jsonb,
    'void', '[]'::jsonb,
    'superseded', '[]'::jsonb
  );
  
  IF p_old_status = p_new_status THEN RETURN true; END IF;
  IF p_old_status IS NULL THEN RETURN true; END IF;
  
  IF v_allowed_transitions ? p_old_status THEN
    RETURN v_allowed_transitions->p_old_status ? p_new_status;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to enforce state machine
CREATE OR REPLACE FUNCTION public.enforce_contract_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.validate_contract_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Transition de statut invalide: % vers %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_contract_status ON public.contracts;
CREATE TRIGGER trg_enforce_contract_status
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enforce_contract_status_transition();

-- =========================================
-- 6. ENHANCED AUTO-GENERATE (IDEMPOTENT)
-- =========================================
CREATE OR REPLACE FUNCTION public.auto_generate_contract_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_number text;
  v_existing_contract_id uuid;
  v_new_contract_id uuid;
  v_idempotency_key text;
BEGIN
  IF (TG_OP = 'UPDATE' AND 
      OLD.payment_status IS DISTINCT FROM NEW.payment_status AND
      NEW.payment_status IN ('captured', 'paid', 'confirmed')) THEN
    
    NEW.payment_confirmed_at := now();
    
    -- IDEMPOTENCY CHECK with row lock
    SELECT id INTO v_existing_contract_id
    FROM public.contracts
    WHERE order_id = NEW.id AND status NOT IN ('void', 'superseded')
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_existing_contract_id IS NOT NULL THEN
      RAISE NOTICE '[ContractAuto] Contract % exists for order %, skipping', v_existing_contract_id, NEW.id;
      RETURN NEW;
    END IF;
    
    v_contract_number := (floor(random() * 8) + 2)::text || lpad(floor(random() * 100000000)::text, 8, '0');
    
    BEGIN
      INSERT INTO public.contracts (
        user_id, owner_user_id, contract_name, contract_url, contract_number,
        order_id, version, status, template_id, template_version, created_at, updated_at
      ) VALUES (
        NEW.user_id, NEW.user_id,
        'Contrat de Service - Commande #' || COALESCE(NEW.order_number, NEW.confirmation_number, NEW.id::text),
        '', v_contract_number, NEW.id, 1, 'waiting_client_signature',
        'contract_template_v2026_02_06', 'v2026.02.07-AutoGen', now(), now()
      )
      RETURNING id INTO v_new_contract_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '[ContractAuto] Contract created by another process for order %', NEW.id;
      RETURN NEW;
    END;
    
    UPDATE public.orders
    SET related_contract_id = v_new_contract_id
    WHERE id = NEW.id AND related_contract_id IS NULL;
    
    v_idempotency_key := 'contract_sig_' || NEW.id::text;
    
    INSERT INTO public.email_queue (
      to_email, template_type, template_data, priority, idempotency_key, created_at
    )
    SELECT 
      COALESCE(p.email, NEW.client_email),
      'contract_ready_for_signature',
      jsonb_build_object(
        'clientName', COALESCE(p.full_name, 'Client'),
        'contractNumber', v_contract_number,
        'contractId', v_new_contract_id,
        'orderNumber', COALESCE(NEW.order_number, NEW.confirmation_number),
        'signatureUrl', '/client/contracts/' || v_new_contract_id::text || '/sign'
      ),
      'high', v_idempotency_key, now()
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.email_queue eq 
        WHERE eq.idempotency_key = v_idempotency_key
      );
    
    RAISE NOTICE '[ContractAuto] Created contract % for order %', v_contract_number, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_generate_contract_on_payment ON public.orders;
CREATE TRIGGER trg_auto_generate_contract_on_payment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_contract_on_payment();

-- =========================================
-- 7. ENHANCED SIGNATURE TOKEN GENERATION (HASHED)
-- =========================================
CREATE OR REPLACE FUNCTION public.generate_contract_signature_token(
  p_contract_id uuid,
  p_role text DEFAULT 'client'
)
RETURNS text AS $$
DECLARE
  v_token text;
  v_token_hash text;
BEGIN
  IF p_role NOT IN ('client', 'admin') THEN
    RAISE EXCEPTION 'Role invalide: client ou admin requis';
  END IF;
  
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  v_token_hash := encode(sha256(v_token::bytea), 'hex');
  
  UPDATE public.contracts
  SET 
    signature_token = v_token,
    signature_token_hash = v_token_hash,
    signature_token_expires_at = now() + interval '7 days',
    signature_token_role = p_role,
    signature_token_used_at = NULL,
    updated_at = now()
  WHERE id = p_contract_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================
-- 8. VALIDATE AND CONSUME SIGNATURE TOKEN
-- =========================================
CREATE OR REPLACE FUNCTION public.validate_signature_token(p_token text)
RETURNS TABLE(contract_id uuid, role text, is_valid boolean, error_message text) AS $$
DECLARE
  v_contract record;
  v_token_hash text;
BEGIN
  v_token_hash := encode(sha256(p_token::bytea), 'hex');
  
  SELECT c.* INTO v_contract
  FROM public.contracts c
  WHERE c.signature_token_hash = v_token_hash AND c.signature_token IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'Token invalide'::text;
    RETURN;
  END IF;
  
  IF v_contract.signature_token_expires_at < now() THEN
    RETURN QUERY SELECT v_contract.id, v_contract.signature_token_role, false, 'Token expiré'::text;
    RETURN;
  END IF;
  
  IF v_contract.signature_token_used_at IS NOT NULL THEN
    RETURN QUERY SELECT v_contract.id, v_contract.signature_token_role, false, 'Token déjà utilisé'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT v_contract.id, v_contract.signature_token_role, true, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================
-- 9. CLIENT SIGN WITH TOKEN
-- =========================================
CREATE OR REPLACE FUNCTION public.client_sign_contract_with_token(
  p_token text,
  p_signature_text text,
  p_signature_type text DEFAULT 'typed'
)
RETURNS jsonb AS $$
DECLARE
  v_validation record;
  v_contract record;
  v_new_status text;
BEGIN
  SELECT * INTO v_validation FROM public.validate_signature_token(p_token);
  
  IF NOT v_validation.is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', v_validation.error_message);
  END IF;
  
  IF v_validation.role != 'client' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token réservé admin');
  END IF;
  
  SELECT * INTO v_contract FROM public.contracts WHERE id = v_validation.contract_id;
  
  v_new_status := CASE WHEN v_contract.admin_signed_at IS NOT NULL THEN 'fully_signed' ELSE 'signed_by_client' END;
  
  UPDATE public.contracts
  SET 
    client_signed_at = now(),
    client_signature = p_signature_text,
    client_signature_type = p_signature_type,
    is_signed = (v_new_status = 'fully_signed'),
    signed_at = CASE WHEN v_new_status = 'fully_signed' THEN now() ELSE signed_at END,
    status = v_new_status,
    signature_token = NULL,
    signature_token_used_at = now(),
    updated_at = now()
  WHERE id = v_validation.contract_id;
  
  RETURN jsonb_build_object('success', true, 'contractId', v_validation.contract_id, 'newStatus', v_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================
-- 10. REGENERATE CONTRACT PDF (versioning)
-- =========================================
CREATE OR REPLACE FUNCTION public.regenerate_contract_pdf(
  p_contract_id uuid,
  p_create_new_version boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_contract record;
  v_new_contract_id uuid;
  v_new_version integer;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id = p_contract_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrat non trouvé');
  END IF;
  
  IF p_create_new_version THEN
    UPDATE public.contracts SET status = 'superseded', updated_at = now() WHERE id = p_contract_id;
    
    v_new_version := COALESCE(v_contract.version, 1) + 1;
    
    INSERT INTO public.contracts (
      user_id, owner_user_id, contract_name, contract_url, contract_number,
      order_id, version, status, template_id, template_version, created_at, updated_at
    ) VALUES (
      v_contract.user_id, v_contract.owner_user_id, v_contract.contract_name,
      '', v_contract.contract_number || '-v' || v_new_version,
      v_contract.order_id, v_new_version, 'waiting_client_signature',
      v_contract.template_id, v_contract.template_version || '-REGEN', now(), now()
    )
    RETURNING id INTO v_new_contract_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'new_version', 'newContractId', v_new_contract_id, 'version', v_new_version);
  ELSE
    UPDATE public.contracts
    SET pdf_generated_at = NULL, template_version = template_version || '-REGEN', updated_at = now()
    WHERE id = p_contract_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'pdf_flagged', 'signaturesPreserved', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================
-- 11. GRANT PERMISSIONS
-- =========================================
GRANT EXECUTE ON FUNCTION public.validate_contract_status_transition(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_signature_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_sign_contract_with_token(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_contract_pdf(uuid, boolean) TO authenticated;