
-- ============================================================
-- INVARIANT: subscription_billing_health_check
-- Couche complémentaire aux garde-fous existants:
--   - fn_subscription_recurring_only_guard (equipment/fee dans frozen_*)
--   - fn_subscription_freeze_guard (frozen_unit_price immuable)
--   - chk_order_items_service_type_recurring_coherence
-- Ajoute:
--   (a) cohérence cycle_end_date vs billing_anchor_day
--   (b) pureté des lignes de factures renewal
-- ============================================================

-- (a) Cohérence de cycle
CREATE OR REPLACE FUNCTION public.fn_subscription_cycle_coherence_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor_day INT;
  v_end_day INT;
BEGIN
  IF NEW.status <> 'active' OR NEW.cycle_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(a.billing_anchor_day, a.billing_cycle_day)
    INTO v_anchor_day
  FROM billing_customers bc
  JOIN accounts a ON a.client_id = bc.user_id
  WHERE bc.id = NEW.customer_id
  LIMIT 1;

  IF v_anchor_day IS NULL THEN
    RETURN NEW; -- Pas d'ancrage défini, on n'impose rien
  END IF;

  v_end_day := EXTRACT(day FROM (NEW.cycle_end_date + INTERVAL '1 day'))::int;

  -- cycle_end_date doit être le jour AVANT l'anchor du mois suivant
  IF v_end_day <> v_anchor_day THEN
    RAISE EXCEPTION
      'INVARIANT-SUBSCRIPTION-CYCLE-COHERENCE: cycle_end_date (%) incohérent avec billing_anchor_day (%) du compte. cycle_end_date doit être (anchor_day - 1).',
      NEW.cycle_end_date, v_anchor_day
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_cycle_coherence ON billing_subscriptions;
CREATE TRIGGER trg_subscription_cycle_coherence
  BEFORE INSERT OR UPDATE OF cycle_end_date, status, customer_id
  ON billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_subscription_cycle_coherence_guard();

-- (b) Pureté des lignes de renouvellement
CREATE OR REPLACE FUNCTION public.fn_renewal_invoice_line_purity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_type billing_invoice_type;
BEGIN
  SELECT type INTO v_invoice_type
  FROM billing_invoices WHERE id = NEW.invoice_id;

  IF v_invoice_type IS DISTINCT FROM 'renewal' THEN
    RETURN NEW;
  END IF;

  -- Bloc 1: line_type interdit sur une renewal
  IF NEW.line_type IN ('equipment','fee') THEN
    RAISE EXCEPTION
      'INVARIANT-RENEWAL-LINE-PURITY: line_type=% interdit sur une facture de renouvellement (id=%). Renewal = recurring services only.',
      NEW.line_type, NEW.invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloc 2: description polluée
  IF NEW.description ~* '(terminal|borne|router|wifi|frais\s+(de\s+)?(mise\s+en\s+service|activation|déplacement|deplacement)|installation|one-?time|hardware|équipement|equipement)' THEN
    RAISE EXCEPTION
      'INVARIANT-RENEWAL-LINE-PURITY: description contient un terme interdit sur une renewal (id=%). Description: %',
      NEW.invoice_id, NEW.description
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_renewal_invoice_line_purity ON billing_invoice_lines;
CREATE TRIGGER trg_renewal_invoice_line_purity
  BEFORE INSERT OR UPDATE
  ON billing_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_renewal_invoice_line_purity_guard();

COMMENT ON FUNCTION public.fn_subscription_cycle_coherence_guard() IS
  'Phase 3 - Invariant #5: cycle_end_date d''un abonnement actif = (billing_anchor_day - 1) du compte.';
COMMENT ON FUNCTION public.fn_renewal_invoice_line_purity_guard() IS
  'Phase 3 - Invariant #6: aucune ligne equipment/fee/description polluée dans une facture de renouvellement.';
