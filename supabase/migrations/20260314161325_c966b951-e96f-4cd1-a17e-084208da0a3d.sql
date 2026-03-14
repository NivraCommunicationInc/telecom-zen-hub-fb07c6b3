
-- ═══════════════════════════════════════════════════════════════
-- SUBSCRIPTION GUARANTEE: Auto-provision when invoice is paid
-- but no subscription exists for the order
-- ═══════════════════════════════════════════════════════════════

-- Trigger: When an invoice transitions to 'paid', if the linked order
-- has no subscription, call provision_services_for_order to create one.
-- This closes the gap where payment confirmation happens but order
-- never reached 'completed' status (which would trigger provisioning).
CREATE OR REPLACE FUNCTION fn_ensure_subscription_on_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_sub_exists boolean;
  v_result jsonb;
BEGIN
  -- Only fire when invoice becomes paid
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.order_id IS NOT NULL THEN
    
    -- Check if a subscription already exists for this order
    SELECT EXISTS(
      SELECT 1 FROM public.billing_subscriptions 
      WHERE order_id = NEW.order_id
    ) INTO v_sub_exists;
    
    IF NOT v_sub_exists THEN
      -- Auto-provision subscription via the canonical RPC
      v_result := public.provision_services_for_order(NEW.order_id);
      
      IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
        -- Log alert but don't block payment confirmation
        INSERT INTO public.billing_system_alerts (
          alert_type, entity_type, entity_id, details
        ) VALUES (
          'subscription_auto_provision_failed',
          'invoice',
          NEW.id::text,
          jsonb_build_object(
            'invoice_number', NEW.invoice_number,
            'order_id', NEW.order_id,
            'error', v_result->>'error',
            'message', v_result->>'message',
            'trigger', 'fn_ensure_subscription_on_invoice_paid'
          )
        );
        RAISE WARNING '[subscription-guarantee] Auto-provision failed for order % (invoice %): %', 
          NEW.order_id, NEW.invoice_number, v_result->>'error';
      ELSE
        RAISE NOTICE '[subscription-guarantee] ✓ Auto-provisioned subscription for order % via invoice % payment', 
          NEW.order_id, NEW.invoice_number;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trg_ensure_subscription_on_invoice_paid ON billing_invoices;
CREATE TRIGGER trg_ensure_subscription_on_invoice_paid
  AFTER UPDATE OF status ON billing_invoices
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION fn_ensure_subscription_on_invoice_paid();

-- Also handle INSERT of already-paid invoice (sync/backfill path)
DROP TRIGGER IF EXISTS trg_ensure_subscription_on_invoice_insert_paid ON billing_invoices;
CREATE TRIGGER trg_ensure_subscription_on_invoice_insert_paid
  AFTER INSERT ON billing_invoices
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND NEW.order_id IS NOT NULL)
  EXECUTE FUNCTION fn_ensure_subscription_on_invoice_paid();

-- ═══════════════════════════════════════════════════════════════
-- RECONCILIATION RPC: Find and fix orphan paid orders
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reconcile_orphan_paid_orders(p_dry_run boolean DEFAULT true)
RETURNS jsonb AS $$
DECLARE
  v_orphan record;
  v_result jsonb;
  v_fixed int := 0;
  v_failed int := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  FOR v_orphan IN
    SELECT o.id as order_id, o.order_number, o.status as order_status,
           o.service_type, o.user_id,
           bi.id as invoice_id, bi.invoice_number, bi.status as invoice_status
    FROM orders o
    LEFT JOIN billing_subscriptions bs ON bs.order_id = o.id
    LEFT JOIN billing_invoices bi ON bi.order_id = o.id AND bi.status = 'paid'
    WHERE o.status IN ('completed', 'paid', 'processing', 'activated', 'delivered', 'installation_completed')
      AND bs.id IS NULL
      AND bi.id IS NOT NULL
    ORDER BY o.created_at DESC
  LOOP
    IF p_dry_run THEN
      v_items := v_items || jsonb_build_object(
        'order_number', v_orphan.order_number,
        'order_status', v_orphan.order_status,
        'invoice_number', v_orphan.invoice_number,
        'service_type', v_orphan.service_type,
        'action', 'would_provision'
      );
      v_fixed := v_fixed + 1;
    ELSE
      v_result := public.provision_services_for_order(v_orphan.order_id);
      IF COALESCE((v_result->>'success')::boolean, false) THEN
        v_items := v_items || jsonb_build_object(
          'order_number', v_orphan.order_number,
          'action', 'provisioned',
          'subscription_id', v_result->>'subscription_id'
        );
        v_fixed := v_fixed + 1;
      ELSE
        v_items := v_items || jsonb_build_object(
          'order_number', v_orphan.order_number,
          'action', 'failed',
          'error', v_result->>'error'
        );
        v_failed := v_failed + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'fixed', v_fixed,
    'failed', v_failed,
    'items', v_items
  );
END;
$$ LANGUAGE plpgsql
SET search_path = public;
