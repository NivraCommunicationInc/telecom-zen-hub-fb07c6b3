-- ============================================================================
-- V2.5: Complete Contract Automation System
-- Adds signature workflow columns + auto-generation trigger improvements
-- ============================================================================

-- 1. Add signature workflow columns to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS admin_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS admin_signer_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS admin_signer_name text,
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS signature_token text UNIQUE,
ADD COLUMN IF NOT EXISTS signature_token_expires_at timestamptz;

-- 2. Update status constraint to include new workflow states
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check 
CHECK (status IN ('draft', 'waiting_client_signature', 'signed_by_client', 'signed_by_admin', 'fully_signed', 'sent', 'void', 'superseded'));

-- 3. Create index for signature token lookup
CREATE INDEX IF NOT EXISTS idx_contracts_signature_token ON public.contracts(signature_token) WHERE signature_token IS NOT NULL;

-- 4. Function to generate secure signature token
CREATE OR REPLACE FUNCTION public.generate_contract_signature_token(p_contract_id uuid)
RETURNS text AS $$
DECLARE
  v_token text;
BEGIN
  -- Generate a secure 32-character token
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  -- Update contract with token (valid for 7 days)
  UPDATE public.contracts
  SET 
    signature_token = v_token,
    signature_token_expires_at = now() + interval '7 days'
  WHERE id = p_contract_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Enhanced auto-generate contract on payment (with PDF generation flag)
CREATE OR REPLACE FUNCTION public.auto_generate_contract_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_number text;
  v_existing_contract_id uuid;
  v_new_contract_id uuid;
BEGIN
  -- Only trigger when payment_status changes to 'captured', 'paid', or 'confirmed'
  IF (TG_OP = 'UPDATE' AND 
      OLD.payment_status IS DISTINCT FROM NEW.payment_status AND
      NEW.payment_status IN ('captured', 'paid', 'confirmed')) THEN
    
    -- Check if a non-void contract already exists for this order
    SELECT id INTO v_existing_contract_id
    FROM public.contracts
    WHERE order_id = NEW.id AND status NOT IN ('void', 'superseded')
    LIMIT 1;
    
    -- If contract exists, skip
    IF v_existing_contract_id IS NOT NULL THEN
      RAISE NOTICE '[ContractAuto] Contract already exists for order %, skipping', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Generate secure 9-digit contract number (Rule 2-9)
    v_contract_number := (floor(random() * 8) + 2)::text || lpad(floor(random() * 100000000)::text, 8, '0');
    
    -- Create contract record with 'waiting_client_signature' status
    INSERT INTO public.contracts (
      user_id,
      owner_user_id,
      contract_name,
      contract_url,
      contract_number,
      order_id,
      version,
      status,
      template_id,
      template_version,
      created_at
    ) VALUES (
      NEW.user_id,
      NEW.user_id,
      'Contrat de Service - Commande #' || COALESCE(NEW.order_number, NEW.confirmation_number, NEW.id::text),
      '',
      v_contract_number,
      NEW.id,
      1,
      'waiting_client_signature', -- Ready for client signature immediately
      'contract_template_v2026_02_06',
      'v2026.02.07-AutoGen',
      now()
    )
    RETURNING id INTO v_new_contract_id;
    
    -- Link contract to order
    UPDATE public.orders
    SET related_contract_id = v_new_contract_id
    WHERE id = NEW.id;
    
    -- Queue email notification to client for signature
    INSERT INTO public.email_queue (
      to_email,
      template_type,
      template_data,
      priority,
      created_at
    )
    SELECT 
      COALESCE(p.email, NEW.client_email),
      'contract_ready_for_signature',
      jsonb_build_object(
        'clientName', COALESCE(p.full_name, 'Client'),
        'contractNumber', v_contract_number,
        'orderNumber', COALESCE(NEW.order_number, NEW.confirmation_number),
        'signatureUrl', '/client/contracts/' || v_new_contract_id::text || '/sign'
      ),
      'high',
      now()
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id;
    
    RAISE NOTICE '[ContractAuto] Created contract % for order %, queued signature email', v_contract_number, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Recreate trigger
DROP TRIGGER IF EXISTS trg_auto_generate_contract_on_payment ON public.orders;
CREATE TRIGGER trg_auto_generate_contract_on_payment
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_contract_on_payment();

-- 7. Function for admin to sign contract
CREATE OR REPLACE FUNCTION public.admin_sign_contract(
  p_contract_id uuid,
  p_admin_user_id uuid,
  p_admin_name text
)
RETURNS jsonb AS $$
DECLARE
  v_contract record;
  v_new_status text;
BEGIN
  -- Get current contract status
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  -- Determine new status based on client signature
  IF v_contract.client_signed_at IS NOT NULL THEN
    v_new_status := 'fully_signed';
  ELSE
    v_new_status := 'signed_by_admin';
  END IF;
  
  -- Update contract
  UPDATE public.contracts
  SET 
    admin_signed_at = now(),
    admin_signer_id = p_admin_user_id,
    admin_signer_name = p_admin_name,
    is_signed = CASE WHEN v_new_status = 'fully_signed' THEN true ELSE is_signed END,
    signed_at = CASE WHEN v_new_status = 'fully_signed' THEN now() ELSE signed_at END,
    status = v_new_status
  WHERE id = p_contract_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'contractId', p_contract_id,
    'newStatus', v_new_status,
    'signedAt', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Function for client to sign contract
CREATE OR REPLACE FUNCTION public.client_sign_contract(
  p_contract_id uuid,
  p_signature_text text,
  p_signature_type text DEFAULT 'typed'
)
RETURNS jsonb AS $$
DECLARE
  v_contract record;
  v_new_status text;
BEGIN
  -- Get current contract status
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id
    AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or access denied');
  END IF;
  
  -- Determine new status based on admin signature
  IF v_contract.admin_signed_at IS NOT NULL THEN
    v_new_status := 'fully_signed';
  ELSE
    v_new_status := 'signed_by_client';
  END IF;
  
  -- Update contract with client signature
  UPDATE public.contracts
  SET 
    client_signed_at = now(),
    client_signature = p_signature_text,
    client_signature_type = p_signature_type,
    is_signed = CASE WHEN v_new_status = 'fully_signed' THEN true ELSE is_signed END,
    signed_at = CASE WHEN v_new_status = 'fully_signed' THEN now() ELSE signed_at END,
    status = v_new_status,
    signature_token = NULL, -- Invalidate token after signing
    signature_token_expires_at = NULL
  WHERE id = p_contract_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'contractId', p_contract_id,
    'newStatus', v_new_status,
    'signedAt', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_contract_signature_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sign_contract(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_sign_contract(uuid, text, text) TO authenticated;