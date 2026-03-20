CREATE OR REPLACE FUNCTION public.trg_guard_cancel_with_confirmed_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    IF EXISTS (
      SELECT 1
      FROM billing_invoices bi
      JOIN billing_payments bp ON bp.invoice_id = bi.id
      WHERE bi.order_id = NEW.id
        AND bp.status = 'confirmed'
        AND bp.amount > 0
    ) THEN
      RAISE EXCEPTION 'Cannot cancel order % — it has a confirmed payment. Refund first.', NEW.order_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;