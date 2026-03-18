-- Enforce telecom-grade invoice invariants and paid-invoice subscription linking

-- 1) Hard block for orphan invoices (prevents void/no-link phantom artifacts)
CREATE OR REPLACE FUNCTION public.fn_block_orphan_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL AND NEW.subscription_id IS NULL THEN
    RAISE EXCEPTION 'ORPHAN_INVOICE_BLOCKED: invoice must reference order_id or subscription_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_block_orphan_invoice ON public.billing_invoices;
CREATE TRIGGER trg_00_block_orphan_invoice
BEFORE INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_block_orphan_invoice();

-- 2) Canonical tax math from subtotal (prevents subtotal/tax/total drift)
CREATE OR REPLACE FUNCTION public.fn_invoice_math_from_subtotal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
BEGIN
  v_subtotal := ROUND(COALESCE(NEW.subtotal, 0)::numeric, 2);
  NEW.subtotal := v_subtotal;
  NEW.tps_amount := ROUND(v_subtotal * 0.05, 2);
  NEW.tvq_amount := ROUND(v_subtotal * 0.09975, 2);
  NEW.total := ROUND(v_subtotal + NEW.tps_amount + NEW.tvq_amount, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_05_invoice_math_from_subtotal ON public.billing_invoices;
CREATE TRIGGER trg_05_invoice_math_from_subtotal
BEFORE INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_invoice_math_from_subtotal();

-- 3) Canonical subtotal from invoice lines (single source of truth)
CREATE OR REPLACE FUNCTION public.fn_sync_invoice_financials_from_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_sum_lines numeric;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ROUND(COALESCE(SUM(line_total), 0)::numeric, 2)
  INTO v_sum_lines
  FROM public.billing_invoice_lines
  WHERE invoice_id = v_invoice_id;

  UPDATE public.billing_invoices bi
  SET subtotal = v_sum_lines
  WHERE bi.id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_financials_from_lines ON public.billing_invoice_lines;
CREATE TRIGGER trg_sync_invoice_financials_from_lines
AFTER INSERT OR UPDATE OR DELETE ON public.billing_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_invoice_financials_from_lines();

-- 4) Auto-attach subscription when invoice is paid and order already has one
CREATE OR REPLACE FUNCTION public.fn_attach_subscription_to_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
BEGIN
  IF NEW.status::text = 'paid'
     AND NEW.subscription_id IS NULL
     AND NEW.order_id IS NOT NULL THEN
    SELECT bs.id
    INTO v_subscription_id
    FROM public.billing_subscriptions bs
    WHERE bs.order_id = NEW.order_id
    ORDER BY bs.updated_at DESC NULLS LAST, bs.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_subscription_id IS NOT NULL THEN
      NEW.subscription_id := v_subscription_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_04_attach_subscription_to_paid_invoice ON public.billing_invoices;
CREATE TRIGGER trg_04_attach_subscription_to_paid_invoice
BEFORE INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_attach_subscription_to_paid_invoice();

-- 5) Backfill paid invoice -> subscription link when subscription is inserted/updated after payment
CREATE OR REPLACE FUNCTION public.fn_backfill_paid_invoice_subscription_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_paid_invoice_id uuid;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT bi.id
  INTO v_paid_invoice_id
  FROM public.billing_invoices bi
  WHERE bi.order_id = NEW.order_id
    AND bi.status::text = 'paid'
    AND bi.subscription_id IS NULL
  ORDER BY bi.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_paid_invoice_id IS NOT NULL THEN
    UPDATE public.billing_invoices
    SET subscription_id = NEW.id
    WHERE id = v_paid_invoice_id;

    IF NEW.status::text <> 'active' AND pg_trigger_depth() < 2 THEN
      UPDATE public.billing_subscriptions
      SET status = 'active',
          last_invoice_id = v_paid_invoice_id,
          updated_at = now()
      WHERE id = NEW.id;
    ELSE
      UPDATE public.billing_subscriptions
      SET last_invoice_id = v_paid_invoice_id,
          updated_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_paid_invoice_subscription_link ON public.billing_subscriptions;
CREATE TRIGGER trg_backfill_paid_invoice_subscription_link
AFTER INSERT OR UPDATE ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.fn_backfill_paid_invoice_subscription_link();