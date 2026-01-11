
-- =============================================================================
-- HARDENING FINAL: 4 CORRECTIONS DURABLES (NON-RÉGRESSION)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 ENFORCE validate_payment_created_by() - BLOQUER (pas default)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_payment_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_automated_sources TEXT[] := ARRAY['system', 'system_migration', 'cron', 'webhook', 'stripe_webhook', 'crypto_ipn', 'nowpayments'];
  v_finalized_statuses TEXT[] := ARRAY['captured', 'completed', 'processed'];
BEGIN
  -- Sources automatisées: auto-fill mais n'accepte pas de NULL finaux
  IF NEW.source = ANY(v_automated_sources) THEN
    IF NEW.created_by_id IS NULL THEN
      NEW.created_by_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;
    IF NEW.created_by_name IS NULL OR NEW.created_by_name = '' THEN
      NEW.created_by_name := 'System';
    END IF;
    IF NEW.created_by_role IS NULL OR NEW.created_by_role = '' THEN
      NEW.created_by_role := 'system';
    END IF;
    RETURN NEW;
  END IF;

  -- Pour les paiements FINALISÉS de source NON-automatisée: BLOQUER si incomplet
  IF NEW.status = ANY(v_finalized_statuses) THEN
    IF NEW.created_by_id IS NULL THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Paiement finalisé (%) sans created_by_id. Source: %', NEW.status, COALESCE(NEW.source, 'null');
    END IF;
    
    IF NEW.created_by_name IS NULL OR TRIM(NEW.created_by_name) = '' THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Paiement finalisé (%) sans created_by_name. Source: %', NEW.status, COALESCE(NEW.source, 'null');
    END IF;
    
    IF NEW.created_by_role IS NULL OR TRIM(NEW.created_by_role) = '' THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Paiement finalisé (%) sans created_by_role. Source: %', NEW.status, COALESCE(NEW.source, 'null');
    END IF;
    
    -- Validate role is in allowed list
    IF NEW.created_by_role NOT IN ('admin', 'manager', 'support', 'billing', 'system', 'client') THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] created_by_role invalide: %. Valeurs permises: admin, manager, support, billing, system, client', NEW.created_by_role;
    END IF;
  END IF;

  -- Pour pending/authorized: permettre mais assurer une source
  IF NEW.source IS NULL OR TRIM(NEW.source) = '' THEN
    NEW.source := 'manual';
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_validate_payment_created_by ON payments;
CREATE TRIGGER trg_validate_payment_created_by
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_created_by();

-- -----------------------------------------------------------------------------
-- 1.2 PROTECT_PAID_INVOICE() - Pattern robuste avec colonnes canoniques
-- Cette version ne référence QUE les colonnes qui existent dans billing
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bypass_mode text;
  -- Colonnes financières CANONIQUES (vérifié via information_schema)
  v_protected_columns TEXT[] := ARRAY[
    'amount', 'subtotal', 'fees', 'credits', 
    'tps_amount', 'tvq_amount', 'delivery_fee', 
    'activation_fee', 'installation_fee', 'discount_amount',
    'late_fee_amount', 'preauth_discount', 'amount_paid', 'balance_due'
  ];
BEGIN
  -- Check for internal reconcile bypass (pour recompute_invoice_balance)
  bypass_mode := current_setting('app.internal_reconcile', true);
  IF bypass_mode = '1' THEN
    RETURN NEW;
  END IF;

  -- Seules les factures PAID sont protégées
  IF OLD.status = 'paid' THEN
    -- Transitions de statut autorisées depuis paid
    IF NEW.status IN ('refunded', 'credited', 'void') THEN
      RETURN NEW;
    END IF;
    
    -- Bloquer changement de statut non autorisé
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION '[IMMUTABILITY] Statut facture payée non modifiable (% → %). Utilisez refunded/credited/void.', OLD.status, NEW.status;
    END IF;
    
    -- Vérification des colonnes financières protégées (pattern safe)
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION '[IMMUTABILITY] amount non modifiable sur facture payée';
    END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
      RAISE EXCEPTION '[IMMUTABILITY] subtotal non modifiable sur facture payée';
    END IF;
    IF NEW.fees IS DISTINCT FROM OLD.fees THEN
      RAISE EXCEPTION '[IMMUTABILITY] fees non modifiable sur facture payée';
    END IF;
    IF NEW.credits IS DISTINCT FROM OLD.credits THEN
      RAISE EXCEPTION '[IMMUTABILITY] credits non modifiable sur facture payée';
    END IF;
    IF NEW.tps_amount IS DISTINCT FROM OLD.tps_amount THEN
      RAISE EXCEPTION '[IMMUTABILITY] tps_amount non modifiable sur facture payée';
    END IF;
    IF NEW.tvq_amount IS DISTINCT FROM OLD.tvq_amount THEN
      RAISE EXCEPTION '[IMMUTABILITY] tvq_amount non modifiable sur facture payée';
    END IF;
    IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee THEN
      RAISE EXCEPTION '[IMMUTABILITY] delivery_fee non modifiable sur facture payée';
    END IF;
    IF NEW.activation_fee IS DISTINCT FROM OLD.activation_fee THEN
      RAISE EXCEPTION '[IMMUTABILITY] activation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.installation_fee IS DISTINCT FROM OLD.installation_fee THEN
      RAISE EXCEPTION '[IMMUTABILITY] installation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
      RAISE EXCEPTION '[IMMUTABILITY] discount_amount non modifiable sur facture payée';
    END IF;
    IF NEW.late_fee_amount IS DISTINCT FROM OLD.late_fee_amount THEN
      RAISE EXCEPTION '[IMMUTABILITY] late_fee_amount non modifiable sur facture payée';
    END IF;
    IF NEW.preauth_discount IS DISTINCT FROM OLD.preauth_discount THEN
      RAISE EXCEPTION '[IMMUTABILITY] preauth_discount non modifiable sur facture payée';
    END IF;
    -- amount_paid et balance_due sont gérés par recompute, donc protégés aussi
    IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
      RAISE EXCEPTION '[IMMUTABILITY] amount_paid non modifiable sur facture payée (utilisez bypass)';
    END IF;
    IF NEW.balance_due IS DISTINCT FROM OLD.balance_due THEN
      RAISE EXCEPTION '[IMMUTABILITY] balance_due non modifiable sur facture payée (utilisez bypass)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_protect_paid_invoice ON billing;
CREATE TRIGGER trg_protect_paid_invoice
  BEFORE UPDATE ON billing
  FOR EACH ROW
  EXECUTE FUNCTION protect_paid_invoice();

-- -----------------------------------------------------------------------------
-- 1.3 REVOKE EXECUTE sur fonctions SECURITY DEFINER
-- Seuls service_role et triggers peuvent les exécuter
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM authenticated;

-- Autoriser service_role uniquement (pour edge functions)
GRANT EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 1.4 CREDIT RECOVERY: Convention claire (positif = crédit disponible)
-- + Utilisation de ledger_entries comme source de vérité
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recover_error_captured_payment(
  p_payment_id uuid, 
  p_action text, 
  p_admin_id uuid, 
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_result JSONB;
  v_ledger_id UUID;
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
        notes = COALESCE(notes, '') || E'\n[RECOVERED:REFUND] ' || now()::text || ' - ' || COALESCE(p_reason, 'Aucune raison'),
        created_by_id = p_admin_id,
        created_by_name = (SELECT COALESCE(full_name, email) FROM profiles WHERE id = p_admin_id),
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      v_result := '{"action":"refund","status":"success"}'::jsonb;
      
    WHEN 'retry' THEN
      UPDATE payments SET 
        status = 'pending',
        error_reason = NULL,
        notes = COALESCE(notes, '') || E'\n[RECOVERED:RETRY] ' || now()::text || ' - ' || COALESCE(p_reason, 'Retry demandé'),
        created_by_id = p_admin_id,
        created_by_name = (SELECT COALESCE(full_name, email) FROM profiles WHERE id = p_admin_id),
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      v_result := '{"action":"retry","status":"success"}'::jsonb;
      
    WHEN 'credit' THEN
      -- CONVENTION UNIQUE: positif = crédit disponible pour le client
      -- 1. Créer une entrée ledger (source de vérité)
      INSERT INTO ledger_entries (
        client_id,
        entry_type,
        amount,
        description,
        source_type,
        source_id,
        created_by_id,
        created_by_name,
        created_by_role
      ) VALUES (
        v_payment.user_id,
        'credit',
        v_payment.amount,  -- Positif = crédit
        'Crédit récupération paiement error_captured: ' || COALESCE(p_reason, ''),
        'payment_recovery',
        p_payment_id,
        p_admin_id,
        (SELECT COALESCE(full_name, email) FROM profiles WHERE id = p_admin_id),
        'admin'
      ) RETURNING id INTO v_ledger_id;
      
      -- 2. Mettre à jour profiles.store_credit (secondaire, ledger est la vérité)
      UPDATE profiles SET 
        store_credit = COALESCE(store_credit, 0) + v_payment.amount
      WHERE id = v_payment.user_id;
      
      -- 3. Mettre à jour le paiement
      UPDATE payments SET 
        status = 'credited',
        notes = COALESCE(notes, '') || E'\n[RECOVERED:CREDIT] ' || v_payment.amount::TEXT || '$ - ledger:' || v_ledger_id::TEXT,
        created_by_id = p_admin_id,
        created_by_name = (SELECT COALESCE(full_name, email) FROM profiles WHERE id = p_admin_id),
        created_by_role = 'admin'
      WHERE id = p_payment_id;
      
      v_result := jsonb_build_object(
        'action', 'credit', 
        'status', 'success', 
        'credited_amount', v_payment.amount,
        'ledger_entry_id', v_ledger_id
      );
      
    ELSE
      RAISE EXCEPTION 'Action invalide: %. Utilisez refund/retry/credit.', p_action;
  END CASE;
  
  -- Audit log
  INSERT INTO activity_logs (
    user_id, entity_type, entity_id, action, 
    actor_role, actor_name, actor_email, details
  )
  VALUES (
    p_admin_id, 'payment', p_payment_id::TEXT, 'payment_recovery_' || p_action, 
    'admin', 
    (SELECT COALESCE(full_name, 'Admin') FROM profiles WHERE id = p_admin_id),
    (SELECT email FROM profiles WHERE id = p_admin_id),
    jsonb_build_object(
      'payment_id', p_payment_id, 
      'action', p_action, 
      'amount', v_payment.amount, 
      'reason', p_reason,
      'original_status', v_payment.status
    )
  );
  
  RETURN v_result;
END;
$function$;

-- -----------------------------------------------------------------------------
-- VÉRIFICATION: colonnes protégées existent dans billing
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_col TEXT;
  v_protected TEXT[] := ARRAY[
    'amount', 'subtotal', 'fees', 'credits', 
    'tps_amount', 'tvq_amount', 'delivery_fee', 
    'activation_fee', 'installation_fee', 'discount_amount',
    'late_fee_amount', 'preauth_discount', 'amount_paid', 'balance_due'
  ];
BEGIN
  FOREACH v_col IN ARRAY v_protected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'billing' 
        AND column_name = v_col
    ) THEN
      v_missing := array_append(v_missing, v_col);
    END IF;
  END LOOP;
  
  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'COLONNES MANQUANTES dans billing: %', array_to_string(v_missing, ', ');
  ELSE
    RAISE NOTICE 'VERIFICATION OK: Toutes les colonnes protégées existent dans billing';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- COMMENTAIRES DE DOCUMENTATION
-- -----------------------------------------------------------------------------
COMMENT ON FUNCTION public.validate_payment_created_by() IS 
'[AUDIT] Enforce created_by_* pour paiements finalisés. Sources auto: system/cron/webhook. RAISE EXCEPTION si incomplet.';

COMMENT ON FUNCTION public.protect_paid_invoice() IS 
'[IMMUTABILITY] Bloque modification des colonnes financières sur factures paid. Bypass: set_config(app.internal_reconcile, 1, true)';

COMMENT ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) IS 
'[RECOVERY] Récupère paiement error_captured. Actions: refund/retry/credit. Credit utilise ledger_entries comme source de vérité.';

COMMENT ON COLUMN public.profiles.store_credit IS 
'[CONVENTION] Positif = crédit disponible pour le client. Ledger_entries est la source de vérité.';
