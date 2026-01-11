-- ============================================================
-- MIGRATION: HARDENING PAIEMENTS + FACTURATION - AUDIT FIX COMPLET
-- ============================================================

-- 1) TRIGGER pour valider created_by_* sur payments
CREATE OR REPLACE FUNCTION public.validate_payment_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Pour les paiements finalisés, s'assurer que source est défini
  IF NEW.status IN ('completed', 'processed', 'captured') THEN
    IF NEW.source IS NULL THEN
      NEW.source := 'manual';
    END IF;
    
    -- Assurer que created_by_role est défini si created_by_id est présent
    IF NEW.created_by_id IS NOT NULL AND NEW.created_by_role IS NULL THEN
      NEW.created_by_role := 'unknown';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_created_by ON public.payments;
CREATE TRIGGER trg_validate_payment_created_by
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_payment_created_by();

-- 2) FONCTION IDEMPOTENTE recompute_invoice_balance
CREATE OR REPLACE FUNCTION public.recompute_invoice_balance(p_invoice_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid NUMERIC := 0;
  v_invoice_amount NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_current_status TEXT;
BEGIN
  -- Récupérer le montant et status de la facture
  SELECT COALESCE(amount, 0), status INTO v_invoice_amount, v_current_status
  FROM public.billing
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculer la somme des paiements valides
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE (billing_id = p_invoice_id OR invoice_id = p_invoice_id)
    AND status IN ('completed', 'processed', 'captured');
  
  -- Calculer le nouveau solde (jamais négatif)
  v_new_balance := GREATEST(0, v_invoice_amount - v_total_paid);
  
  -- Mettre à jour la facture (sans toucher aux champs protégés si paid)
  UPDATE public.billing
  SET 
    balance_due = v_new_balance,
    amount_paid = v_total_paid,
    status = CASE 
      WHEN v_current_status = 'paid' THEN 'paid'
      WHEN v_new_balance <= 0 THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE v_current_status
    END,
    paid_at = CASE 
      WHEN v_new_balance <= 0 AND paid_at IS NULL THEN now()
      ELSE paid_at
    END
  WHERE id = p_invoice_id;
END;
$$;

-- 3) TRIGGER pour recompute sur payments
DROP TRIGGER IF EXISTS trg_sync_billing_on_payment ON public.payments;

CREATE OR REPLACE FUNCTION public.trigger_recompute_invoice_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.billing_id IS NOT NULL AND OLD.billing_id IS DISTINCT FROM NEW.billing_id THEN
      PERFORM public.recompute_invoice_balance(OLD.billing_id);
    END IF;
    IF OLD.invoice_id IS NOT NULL AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
      PERFORM public.recompute_invoice_balance(OLD.invoice_id);
    END IF;
  END IF;
  
  IF NEW.billing_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_balance(NEW.billing_id);
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_balance(NEW.invoice_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recompute_invoice_on_payment
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recompute_invoice_on_payment();

-- 4) IMMUTABILITÉ FACTURE PAID
CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    -- Champs financiers protégés
    IF NEW.amount IS DISTINCT FROM OLD.amount 
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tps_amount IS DISTINCT FROM OLD.tps_amount
       OR NEW.tvq_amount IS DISTINCT FROM OLD.tvq_amount
       OR NEW.fees IS DISTINCT FROM OLD.fees
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.installation_fee IS DISTINCT FROM OLD.installation_fee
       OR NEW.activation_fee IS DISTINCT FROM OLD.activation_fee THEN
      RAISE EXCEPTION 'Cannot modify financial fields of a paid invoice. Use credit note instead.';
    END IF;
    
    IF NEW.status IS DISTINCT FROM 'paid' AND NEW.status NOT IN ('refunded', 'credited') THEN
      RAISE EXCEPTION 'Cannot change status of paid invoice to %. Use refund process.', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_paid_invoice ON public.billing;
CREATE TRIGGER trg_protect_paid_invoice
BEFORE UPDATE ON public.billing
FOR EACH ROW
EXECUTE FUNCTION public.protect_paid_invoice();

-- 5) CONTRAINTES positives
ALTER TABLE public.billing 
DROP CONSTRAINT IF EXISTS chk_billing_balance_due_positive;
ALTER TABLE public.billing 
ADD CONSTRAINT chk_billing_balance_due_positive 
CHECK (balance_due IS NULL OR balance_due >= 0);

ALTER TABLE public.billing 
DROP CONSTRAINT IF EXISTS chk_billing_amount_paid_positive;
ALTER TABLE public.billing 
ADD CONSTRAINT chk_billing_amount_paid_positive 
CHECK (amount_paid IS NULL OR amount_paid >= 0);

-- 6) FONCTION mark_payment_error_captured
CREATE OR REPLACE FUNCTION public.mark_payment_error_captured(
  p_payment_id UUID,
  p_error_reason TEXT,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_admin_ids UUID[];
  v_admin_id UUID;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;
  
  UPDATE public.payments
  SET 
    status = 'error_captured',
    error_reason = p_error_reason,
    notes = COALESCE(notes, '') || E'\n[ERROR_CAPTURED] ' || now()::text || ': ' || p_error_reason
  WHERE id = p_payment_id;
  
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (
    COALESCE(p_admin_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'payment_error_captured',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'error_reason', p_error_reason,
      'original_status', v_payment.status,
      'amount', v_payment.amount,
      'user_id', v_payment.user_id
    )
  );
  
  SELECT ARRAY_AGG(ur.user_id) INTO v_admin_ids
  FROM public.user_roles ur WHERE ur.role = 'admin';
  
  IF v_admin_ids IS NOT NULL THEN
    FOREACH v_admin_id IN ARRAY v_admin_ids LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'admin',
        'payment',
        'ALERTE: Paiement capturé mais erreur',
        'Paiement ' || COALESCE(v_payment.reference_number, p_payment_id::text) || ' - ' || p_error_reason,
        '/admin/billing',
        p_payment_id
      );
    END LOOP;
  END IF;
END;
$$;

-- 7) FONCTION recover_error_captured_payment
CREATE OR REPLACE FUNCTION public.recover_error_captured_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_admin_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;
  
  IF v_payment.status != 'error_captured' THEN
    RAISE EXCEPTION 'Payment is not in error_captured status';
  END IF;
  
  CASE p_action
    WHEN 'refund' THEN
      UPDATE public.payments
      SET 
        status = 'refunded',
        notes = COALESCE(notes, '') || E'\n[RECOVERED:REFUND] ' || now()::text || ': ' || COALESCE(p_notes, 'Admin recovery')
      WHERE id = p_payment_id;
      
    WHEN 'retry' THEN
      UPDATE public.payments
      SET 
        status = 'completed',
        error_reason = NULL,
        notes = COALESCE(notes, '') || E'\n[RECOVERED:RETRY] ' || now()::text || ': ' || COALESCE(p_notes, 'Admin recovery')
      WHERE id = p_payment_id;
      
      IF v_payment.billing_id IS NOT NULL THEN
        PERFORM public.recompute_invoice_balance(v_payment.billing_id);
      END IF;
      IF v_payment.invoice_id IS NOT NULL THEN
        PERFORM public.recompute_invoice_balance(v_payment.invoice_id);
      END IF;
      
    WHEN 'credit' THEN
      UPDATE public.payments
      SET 
        status = 'processed',
        notes = COALESCE(notes, '') || E'\n[RECOVERED:CREDIT] ' || now()::text || ': Converted to account credit. ' || COALESCE(p_notes, '')
      WHERE id = p_payment_id;
      
      UPDATE public.profiles
      SET balance = COALESCE(balance, 0) - v_payment.amount
      WHERE user_id = v_payment.user_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid action: %. Use refund, retry, or credit.', p_action;
  END CASE;
  
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (
    p_admin_user_id,
    'payment_recovery_' || p_action,
    'payment',
    p_payment_id,
    jsonb_build_object('action', p_action, 'notes', p_notes, 'amount', v_payment.amount)
  );
END;
$$;