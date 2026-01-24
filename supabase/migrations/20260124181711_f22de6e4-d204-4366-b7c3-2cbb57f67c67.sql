
-- ============================================
-- PHASE 1: ACTIVATION DES TRIGGERS & CORRECTIONS
-- ============================================

-- 1. ENABLE tous les triggers désactivés sur billing
ALTER TABLE public.billing ENABLE TRIGGER on_billing_overdue;
ALTER TABLE public.billing ENABLE TRIGGER tr_billing_email;
ALTER TABLE public.billing ENABLE TRIGGER trg_protect_paid_invoice;
ALTER TABLE public.billing ENABLE TRIGGER trg_sync_billing_to_ledger;
ALTER TABLE public.billing ENABLE TRIGGER trg_sync_profile_balance;
ALTER TABLE public.billing ENABLE TRIGGER trigger_calculate_billing_total;
ALTER TABLE public.billing ENABLE TRIGGER trigger_notify_new_invoice;
ALTER TABLE public.billing ENABLE TRIGGER trigger_set_invoice_number;

-- 2. ENABLE triggers sur payments
ALTER TABLE public.payments ENABLE TRIGGER trg_recompute_invoice_on_payment;
ALTER TABLE public.payments ENABLE TRIGGER trg_validate_payment_created_by;
ALTER TABLE public.payments ENABLE TRIGGER trigger_create_ledger_on_payment;
ALTER TABLE public.payments ENABLE TRIGGER trigger_prevent_double_payment;
ALTER TABLE public.payments ENABLE TRIGGER trigger_update_invoice_balance;

-- 3. ENABLE triggers sur autres tables
ALTER TABLE public.subscriptions ENABLE TRIGGER subscription_bill_cycle_trigger;
ALTER TABLE public.subscriptions ENABLE TRIGGER update_subscriptions_updated_at;
ALTER TABLE public.accounts ENABLE TRIGGER trigger_set_account_billing_cycle;
ALTER TABLE public.accounts ENABLE TRIGGER trigger_set_account_number;
ALTER TABLE public.accounts ENABLE TRIGGER trigger_update_accounts_timestamp;
ALTER TABLE public.monthly_invoices ENABLE TRIGGER set_monthly_invoice_number_trigger;
ALTER TABLE public.monthly_invoices ENABLE TRIGGER trg_sync_monthly_invoice_to_ledger;
ALTER TABLE public.monthly_invoices ENABLE TRIGGER update_monthly_invoices_timestamp;
ALTER TABLE public.billing_invoices ENABLE TRIGGER on_invoice_paid_update_subscription;
ALTER TABLE public.billing_invoices ENABLE TRIGGER trg_billing_invoice_failed;
ALTER TABLE public.billing_invoices ENABLE TRIGGER trg_billing_invoice_paid;

-- 4. Ajouter colonne manquante sur billing si pas présente (pour l'activation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'service_activated_at') THEN
    ALTER TABLE public.billing ADD COLUMN service_activated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'service_status') THEN
    ALTER TABLE public.billing ADD COLUMN service_status TEXT DEFAULT 'pending';
  END IF;
END$$;

-- 5. Créer index pour performance des lookups
CREATE INDEX IF NOT EXISTS idx_billing_user_status ON public.billing(user_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON public.billing(due_date) WHERE status IN ('pending', 'overdue');
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_billing_id ON public.payments(billing_id) WHERE billing_id IS NOT NULL;

-- 6. Fonction pour lier automatiquement les paiements aux factures
CREATE OR REPLACE FUNCTION public.auto_link_payment_to_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_oldest_unpaid_billing_id UUID;
BEGIN
  -- Si billing_id est NULL et qu'on a un user_id, trouver la plus ancienne facture impayée
  IF NEW.billing_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_oldest_unpaid_billing_id
    FROM public.billing
    WHERE user_id = NEW.user_id
      AND status IN ('pending', 'overdue', 'partial')
      AND (balance_due > 0 OR balance_due IS NULL)
    ORDER BY due_date ASC NULLS LAST, created_at ASC
    LIMIT 1;
    
    IF v_oldest_unpaid_billing_id IS NOT NULL THEN
      NEW.billing_id := v_oldest_unpaid_billing_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger pour auto-link
DROP TRIGGER IF EXISTS trg_auto_link_payment ON public.payments;
CREATE TRIGGER trg_auto_link_payment
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_payment_to_invoice();

-- 7. Fonction améliorée pour mettre à jour le solde de la facture
CREATE OR REPLACE FUNCTION public.update_billing_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total NUMERIC;
  v_total_paid NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Seulement pour les paiements capturés/complétés
  IF NEW.status NOT IN ('completed', 'processed', 'captured') THEN
    RETURN NEW;
  END IF;
  
  -- Si pas de billing_id, rien à faire
  IF NEW.billing_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculer le total payé pour cette facture
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE billing_id = NEW.billing_id
    AND status IN ('completed', 'processed', 'captured')
    AND id != NEW.id;
  
  v_total_paid := v_total_paid + NEW.amount;
  
  -- Récupérer le total de la facture
  SELECT amount INTO v_invoice_total
  FROM public.billing
  WHERE id = NEW.billing_id;
  
  -- Calculer le nouveau solde
  v_new_balance := GREATEST(0, v_invoice_total - v_total_paid);
  
  -- Déterminer le nouveau statut
  IF v_new_balance <= 0 THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;
  
  -- Mettre à jour la facture
  UPDATE public.billing
  SET 
    amount_paid = v_total_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    captured_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE captured_at END,
    service_activated_at = CASE WHEN v_new_status = 'paid' AND service_activated_at IS NULL THEN NOW() ELSE service_activated_at END,
    service_status = CASE WHEN v_new_status = 'paid' THEN 'active' ELSE service_status END
  WHERE id = NEW.billing_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_update_billing_on_payment ON public.payments;
CREATE TRIGGER trg_update_billing_on_payment
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_on_payment();

-- 8. Fonction pour activer le service quand facture payée
CREATE OR REPLACE FUNCTION public.activate_service_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand une facture passe à 'paid', activer le service
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Mettre à jour la facture avec l'activation
    NEW.service_activated_at := COALESCE(NEW.service_activated_at, NOW());
    NEW.service_status := 'active';
    
    -- Si lié à une commande, mettre à jour son statut
    IF NEW.order_id IS NOT NULL THEN
      UPDATE public.orders
      SET status = 'completed', 
          payment_status = 'captured',
          updated_at = NOW()
      WHERE id = NEW.order_id;
    END IF;
    
    -- Si le client a un account, l'activer aussi
    UPDATE public.accounts
    SET status = 'active', updated_at = NOW()
    WHERE client_id = NEW.user_id
      AND status != 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activate_service_on_billing_paid ON public.billing;
CREATE TRIGGER trg_activate_service_on_billing_paid
  BEFORE UPDATE ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_service_on_payment();

-- 9. Fonction pour les rappels de paiement automatiques
CREATE OR REPLACE FUNCTION public.check_and_queue_payment_reminders()
RETURNS void AS $$
DECLARE
  v_invoice RECORD;
  v_today DATE := CURRENT_DATE;
  v_days_until_due INTEGER;
  v_reminder_type TEXT;
  v_email TEXT;
  v_client_name TEXT;
BEGIN
  FOR v_invoice IN 
    SELECT b.*, p.email, p.full_name
    FROM public.billing b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
    WHERE b.status IN ('pending', 'overdue')
      AND b.due_date IS NOT NULL
      AND (b.balance_due > 0 OR b.balance_due IS NULL)
  LOOP
    v_days_until_due := v_invoice.due_date - v_today;
    v_email := COALESCE(v_invoice.email, v_invoice.client_email);
    v_client_name := COALESCE(v_invoice.full_name, 'Client');
    
    -- Skip si pas d'email
    IF v_email IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Déterminer le type de rappel
    v_reminder_type := NULL;
    IF v_days_until_due = 7 THEN
      v_reminder_type := 'payment_reminder_7days';
    ELSIF v_days_until_due = 3 THEN
      v_reminder_type := 'payment_reminder_3days';
    ELSIF v_days_until_due = 1 THEN
      v_reminder_type := 'payment_reminder_1day';
    ELSIF v_days_until_due = 0 THEN
      v_reminder_type := 'payment_due_today';
    ELSIF v_days_until_due = -1 THEN
      v_reminder_type := 'payment_overdue_1day';
      -- Marquer comme overdue
      UPDATE public.billing SET status = 'overdue' WHERE id = v_invoice.id AND status = 'pending';
    ELSIF v_days_until_due <= -3 AND NOT v_invoice.late_fee_applied THEN
      v_reminder_type := 'payment_overdue_late_fee';
      -- Appliquer frais de retard 5%
      UPDATE public.billing 
      SET late_fee_applied = true,
          late_fee_amount = ROUND(amount * 0.05, 2),
          fees = COALESCE(fees, 0) + ROUND(amount * 0.05, 2),
          status = 'overdue'
      WHERE id = v_invoice.id;
    END IF;
    
    -- Si un rappel est nécessaire, vérifier s'il n'a pas déjà été envoyé aujourd'hui
    IF v_reminder_type IS NOT NULL THEN
      INSERT INTO public.email_queue (
        event_key,
        to_email,
        template_key,
        template_vars,
        status
      )
      SELECT 
        v_invoice.id || '-' || v_reminder_type || '-' || v_today,
        v_email,
        v_reminder_type,
        jsonb_build_object(
          'client_name', v_client_name,
          'invoice_number', v_invoice.invoice_number,
          'amount', v_invoice.amount,
          'due_date', v_invoice.due_date,
          'balance_due', COALESCE(v_invoice.balance_due, v_invoice.amount)
        ),
        'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.email_queue
        WHERE event_key = v_invoice.id || '-' || v_reminder_type || '-' || v_today
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Contrainte pour empêcher balance_due négative
ALTER TABLE public.billing DROP CONSTRAINT IF EXISTS chk_billing_balance_non_negative;
ALTER TABLE public.billing ADD CONSTRAINT chk_billing_balance_non_negative CHECK (balance_due >= 0 OR balance_due IS NULL);

-- 11. Contrainte pour empêcher amount_paid > amount
ALTER TABLE public.billing DROP CONSTRAINT IF EXISTS chk_billing_amount_paid_valid;

-- 12. Ajouter commentaires pour documentation
COMMENT ON TABLE public.billing IS 'Table principale de facturation - source de vérité unique pour les factures';
COMMENT ON COLUMN public.billing.service_status IS 'Statut du service: pending, active, suspended, cancelled';
COMMENT ON COLUMN public.billing.service_activated_at IS 'Date/heure d''activation du service après paiement confirmé';
