-- Phase 3.B hardening — PayPal must remain frozen at database level

CREATE OR REPLACE FUNCTION public._is_paypal_context(_provider TEXT, _rpc_used TEXT DEFAULT NULL, _payment_kind TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    (coalesce(_payment_kind, '') IS DISTINCT FROM 'legacy_readonly')
    AND (
      lower(coalesce(_provider, '')) = 'paypal'
      OR lower(coalesce(_rpc_used, '')) LIKE '%paypal%'
    )
$$;

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_billing_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_paypal_context(NEW.provider, NEW.rpc_used, NEW.payment_kind)
     OR lower(coalesce(NEW.method::text, '')) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: New PayPal billing payments are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_billing_payment ON public.billing_payments;
CREATE TRIGGER trg_forbid_paypal_billing_payment
  BEFORE INSERT OR UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_billing_payment();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_invoice_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF lower(coalesce(v_ctx, '')) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Invoice writes from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_invoice_write ON public.billing_invoices;
CREATE TRIGGER trg_forbid_paypal_invoice_write
  BEFORE INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_invoice_write();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_invoice_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF lower(coalesce(v_ctx, '')) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Invoice line writes from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_invoice_line ON public.billing_invoice_lines;
CREATE TRIGGER trg_forbid_paypal_invoice_line
  BEFORE INSERT OR UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_invoice_line();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_subscription_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);

  IF TG_OP = 'INSERT' THEN
    IF NEW.paypal_subscription_id IS NOT NULL OR NEW.paypal_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: New PayPal subscription identifiers are forbidden'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id
       AND NEW.paypal_subscription_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Updating PayPal subscription identifiers is forbidden'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id
       AND NEW.paypal_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Updating PayPal plan identifiers is forbidden'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF lower(coalesce(v_ctx, '')) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Subscription writes from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_subscription_write ON public.billing_subscriptions;
CREATE TRIGGER trg_forbid_paypal_subscription_write
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_subscription_write();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF lower(coalesce(v_ctx, '')) = 'paypal'
     OR lower(coalesce(NEW.source, '')) LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Account adjustments from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_adjustment ON public.account_adjustments;
CREATE TRIGGER trg_forbid_paypal_adjustment
  BEFORE INSERT OR UPDATE ON public.account_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_adjustment();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF lower(coalesce(v_ctx, '')) = 'paypal'
     OR lower(coalesce(NEW.source, '')) LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: Account promotions from PayPal context are forbidden'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_promotion ON public.account_promotions;
CREATE TRIGGER trg_forbid_paypal_promotion
  BEFORE INSERT OR UPDATE ON public.account_promotions
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_promotion();

CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_order_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.payment_method::text, '')) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B-PAYPAL-FROZEN: New PayPal order payment methods are forbidden; use Square/card instead'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_order_payment_method ON public.orders;
CREATE TRIGGER trg_forbid_paypal_order_payment_method
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_order_payment_method();

DROP TRIGGER IF EXISTS trg_forbid_paypal_field_order_payment_method ON public.field_sales_orders;
CREATE TRIGGER trg_forbid_paypal_field_order_payment_method
  BEFORE INSERT OR UPDATE ON public.field_sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_order_payment_method();