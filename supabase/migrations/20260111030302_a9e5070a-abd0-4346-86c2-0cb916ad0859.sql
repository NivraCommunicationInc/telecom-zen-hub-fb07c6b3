
-- ============================================================
-- MIGRATION: Hardening final - avec DROP FUNCTION explicite
-- ============================================================

-- 1. DROP fonction recover si elle existe avec mauvaise signature
DROP FUNCTION IF EXISTS recover_error_captured_payment(UUID, TEXT, UUID, TEXT);

-- 2. Recréer le trigger de protection (il a été droppé dans la migration précédente)
CREATE OR REPLACE FUNCTION protect_paid_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    IF NEW.status IN ('refunded', 'credited') THEN
      RETURN NEW;
    END IF;
    
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'IMMUTABILITY: Statut facture payée non modifiable (% → %)', OLD.status, NEW.status;
    END IF;
    
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: amount non modifiable sur facture payée';
    END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
      RAISE EXCEPTION 'IMMUTABILITY: subtotal non modifiable sur facture payée';
    END IF;
    IF NEW.fees IS DISTINCT FROM OLD.fees THEN
      RAISE EXCEPTION 'IMMUTABILITY: fees non modifiable sur facture payée';
    END IF;
    IF NEW.credits IS DISTINCT FROM OLD.credits THEN
      RAISE EXCEPTION 'IMMUTABILITY: credits non modifiable sur facture payée';
    END IF;
    IF NEW.tps_amount IS DISTINCT FROM OLD.tps_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: tps_amount non modifiable sur facture payée';
    END IF;
    IF NEW.tvq_amount IS DISTINCT FROM OLD.tvq_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: tvq_amount non modifiable sur facture payée';
    END IF;
    IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: delivery_fee non modifiable sur facture payée';
    END IF;
    IF NEW.activation_fee IS DISTINCT FROM OLD.activation_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: activation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.installation_fee IS DISTINCT FROM OLD.installation_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: installation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: discount_amount non modifiable sur facture payée';
    END IF;
    IF NEW.late_fee_amount IS DISTINCT FROM OLD.late_fee_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: late_fee_amount non modifiable sur facture payée';
    END IF;
    IF NEW.preauth_discount IS DISTINCT FROM OLD.preauth_discount THEN
      RAISE EXCEPTION 'IMMUTABILITY: preauth_discount non modifiable sur facture payée';
    END IF;
    IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
      RAISE EXCEPTION 'IMMUTABILITY: amount_paid non modifiable sur facture payée';
    END IF;
    IF NEW.balance_due IS DISTINCT FROM OLD.balance_due THEN
      RAISE EXCEPTION 'IMMUTABILITY: balance_due non modifiable sur facture payée';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger s'il n'existe pas
DROP TRIGGER IF EXISTS trg_protect_paid_invoice ON billing;
CREATE TRIGGER trg_protect_paid_invoice
  BEFORE UPDATE ON billing
  FOR EACH ROW
  EXECUTE FUNCTION protect_paid_invoice();

-- 3. RECOVER_ERROR_CAPTURED_PAYMENT avec convention crédit
CREATE FUNCTION recover_error_captured_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement non trouvé: %', p_payment_id;
  END IF;
  
  IF v_payment.status != 'error_captured' THEN
    RAISE EXCEPTION 'Paiement doit être error_captured (actuel: %)', v_payment.status;
  END IF;
  
  CASE p_action
    WHEN 'refund' THEN
      UPDATE payments SET 
        status = 'refunded',
        notes = COALESCE(notes, '') || E'\n[RECOVERY] Remboursé: ' || COALESCE(p_reason, ''),
        created_by_id = p_admin_id,
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      v_result := '{"action":"refund","status":"success"}'::jsonb;
      
    WHEN 'retry' THEN
      UPDATE payments SET 
        status = 'pending',
        error_reason = NULL,
        notes = COALESCE(notes, '') || E'\n[RECOVERY] Retry: ' || COALESCE(p_reason, ''),
        created_by_id = p_admin_id,
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      v_result := '{"action":"retry","status":"success"}'::jsonb;
      
    WHEN 'credit' THEN
      -- CONVENTION: profiles.balance POSITIF = crédit disponible
      UPDATE profiles SET 
        balance = COALESCE(balance, 0) + v_payment.amount,
        store_credit = COALESCE(store_credit, 0) + v_payment.amount
      WHERE user_id = v_payment.user_id;
      
      UPDATE payments SET 
        status = 'credited',
        notes = COALESCE(notes, '') || E'\n[RECOVERY] Crédit: ' || v_payment.amount::TEXT || '$ - ' || COALESCE(p_reason, ''),
        created_by_id = p_admin_id,
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      
      v_result := jsonb_build_object('action', 'credit', 'status', 'success', 'credited_amount', v_payment.amount);
      
    ELSE
      RAISE EXCEPTION 'Action invalide: %. Utilisez refund/retry/credit.', p_action;
  END CASE;
  
  INSERT INTO activity_logs (user_id, entity_type, entity_id, action, actor_role, actor_name, details)
  VALUES (p_admin_id, 'payment', p_payment_id::TEXT, 'payment_recovery_' || p_action, 'admin', 'Admin Recovery',
    jsonb_build_object('payment_id', p_payment_id, 'action', p_action, 'amount', v_payment.amount, 'reason', p_reason));
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permissions sur recover_error_captured_payment
REVOKE EXECUTE ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) TO service_role;

-- 5. Documentation
COMMENT ON FUNCTION protect_paid_invoice() IS 'IMMUTABILITY: Bloque modification financière sur facture payée';
COMMENT ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) IS 'ADMIN: Recovery error_captured. profiles.balance POSITIF = crédit';
COMMENT ON COLUMN profiles.balance IS 'Crédit client. POSITIF = disponible pour payer factures.';
