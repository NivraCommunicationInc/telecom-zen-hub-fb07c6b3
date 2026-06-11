-- ============================================================
-- Billing anchor date + order→subscription coherence + reconciliation
-- ============================================================

-- 1. Backfill billing_anchor_date on existing active subscriptions
UPDATE billing_subscriptions
SET billing_anchor_date = cycle_start_date
WHERE billing_anchor_date IS NULL
  AND cycle_start_date IS NOT NULL;

-- 2. Trigger: cancel linked subscription when an order is cancelled
CREATE OR REPLACE FUNCTION public.cancel_subscription_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE billing_subscriptions
    SET status = 'cancelled', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('active', 'pending', 'suspended');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancel_subscription ON orders;
CREATE TRIGGER trg_order_cancel_subscription
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION public.cancel_subscription_on_order_cancel();

-- 3. Reconciliation function — call SELECT * FROM billing_reconciliation_check()
CREATE OR REPLACE FUNCTION public.billing_reconciliation_check()
RETURNS TABLE(
  check_type  TEXT,
  entity_id   UUID,
  severity    TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Active subscriptions without any invoice
  RETURN QUERY
  SELECT
    'active_sub_no_invoice'::TEXT,
    s.id,
    'critical'::TEXT,
    format('Sub actif %s (%s) sans facture', s.id, s.plan_name)
  FROM billing_subscriptions s
  WHERE s.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM billing_invoices i WHERE i.subscription_id = s.id);

  -- Void/cancelled invoices with balance_due > 0
  RETURN QUERY
  SELECT
    'void_invoice_nonzero_balance'::TEXT,
    i.id,
    'high'::TEXT,
    format('Facture %s statut=%s balance_due=%s', i.invoice_number, i.status, i.balance_due)
  FROM billing_invoices i
  WHERE i.status IN ('void', 'cancelled')
    AND i.balance_due > 0;

  -- Active subscriptions with NULL cycle_end_date
  RETURN QUERY
  SELECT
    'active_sub_null_cycle'::TEXT,
    s.id,
    'critical'::TEXT,
    format('Sub actif %s sans cycle_end_date — jamais renouvelé', s.id)
  FROM billing_subscriptions s
  WHERE s.status = 'active'
    AND s.cycle_end_date IS NULL;

  -- Active subscriptions with NULL billing_anchor_date
  RETURN QUERY
  SELECT
    'active_sub_null_anchor'::TEXT,
    s.id,
    'high'::TEXT,
    format('Sub actif %s sans billing_anchor_date — cycle glissant au lieu de mensuel fixe', s.id)
  FROM billing_subscriptions s
  WHERE s.status = 'active'
    AND s.billing_anchor_date IS NULL;

  -- Active subscriptions linked to a cancelled order
  RETURN QUERY
  SELECT
    'active_sub_dead_order'::TEXT,
    s.id,
    'critical'::TEXT,
    format('Sub actif %s lié à commande %s (statut: %s)', s.id, o.id, o.status)
  FROM billing_subscriptions s
  JOIN orders o ON o.id = s.order_id
  WHERE s.status = 'active'
    AND o.status IN ('cancelled', 'void');

  -- Non-void invoices with no linked subscription
  RETURN QUERY
  SELECT
    'orphaned_invoice'::TEXT,
    i.id,
    'high'::TEXT,
    format('Facture %s (statut: %s) sans abonnement lié', i.invoice_number, i.status)
  FROM billing_invoices i
  WHERE i.subscription_id IS NULL
    AND i.status NOT IN ('void', 'cancelled');
END;
$$;
