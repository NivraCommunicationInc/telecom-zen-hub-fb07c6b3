-- =============================================================
-- 1. TRIGGER: Block credit_class update by non-staff
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_block_credit_class_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.credit_class IS DISTINCT FROM NEW.credit_class THEN
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'CREDIT_CLASS_UPDATE_BLOCKED: Only staff can modify credit_class';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_credit_class_update ON public.accounts;
CREATE TRIGGER trg_block_credit_class_update
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_block_credit_class_update();

-- =============================================================
-- 2. TRIGGER: Guard provisioning - block activation without invoice
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_provisioning_requires_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_exists boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.billing_invoices
      WHERE order_id = NEW.id
        AND status NOT IN ('void','cancelled')
    ) INTO invoice_exists;

    IF NOT invoice_exists THEN
      NEW.status := 'provisioning_failed';
      INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, details)
      VALUES (
        'provisioning_blocked_no_invoice',
        'order',
        NEW.id::text,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'reason', 'No valid invoice found for this order. Completion blocked.',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provisioning_requires_invoice ON public.orders;
CREATE TRIGGER trg_guard_provisioning_requires_invoice
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_provisioning_requires_invoice();

-- =============================================================
-- 3. TRIGGER: Validate invoice has lines before leaving draft
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_validate_invoice_has_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' AND (OLD.status = 'draft' OR OLD.status IS NULL) THEN
    SELECT count(*) INTO line_count
    FROM public.billing_invoice_lines
    WHERE invoice_id = NEW.id;

    IF line_count = 0 THEN
      RAISE EXCEPTION 'INVOICE_REQUIRES_LINES: Invoice % cannot leave draft without line items', NEW.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invoice_has_lines ON public.billing_invoices;
CREATE TRIGGER trg_validate_invoice_has_lines
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_invoice_has_lines();

-- =============================================================
-- 4. TRIGGER: Sync last_invoice_id on invoice creation
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_last_invoice_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    UPDATE public.billing_subscriptions
    SET last_invoice_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_last_invoice_id ON public.billing_invoices;
CREATE TRIGGER trg_sync_last_invoice_id
  AFTER INSERT ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_last_invoice_id();