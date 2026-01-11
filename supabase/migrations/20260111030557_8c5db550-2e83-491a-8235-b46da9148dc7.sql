
-- Modifier recompute_invoice_balance pour ne PAS modifier les factures déjà paid
CREATE OR REPLACE FUNCTION recompute_invoice_balance(p_invoice_id UUID)
RETURNS void AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_amount NUMERIC;
  v_new_balance NUMERIC;
  v_current_status TEXT;
BEGIN
  -- Récupérer le statut actuel
  SELECT status, amount INTO v_current_status, v_invoice_amount 
  FROM billing WHERE id = p_invoice_id;
  
  -- NE PAS TOUCHER aux factures déjà paid (immutabilité)
  IF v_current_status = 'paid' THEN
    RETURN;
  END IF;
  
  -- Calculer le total des paiements validés
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE (billing_id = p_invoice_id OR invoice_id = p_invoice_id)
    AND status IN ('completed', 'processed', 'captured');
  
  -- Calculer le nouveau solde
  v_new_balance := GREATEST(0, v_invoice_amount - v_total_paid);
  
  -- Mettre à jour la facture
  UPDATE billing
  SET 
    balance_due = v_new_balance,
    amount_paid = v_total_paid,
    status = CASE 
      WHEN v_new_balance <= 0 THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE 
      WHEN v_new_balance <= 0 AND paid_at IS NULL THEN now()
      ELSE paid_at
    END
  WHERE id = p_invoice_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
