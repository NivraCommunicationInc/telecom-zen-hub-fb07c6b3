-- AUDIT FIX: Ajouter RLS SELECT pour clients sur payments
CREATE POLICY "Clients can view their own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = client_id);

-- AUDIT FIX: Ajouter RLS SELECT pour clients sur appointments
CREATE POLICY "Clients can view their own appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = client_id);

-- AUDIT FIX: Restreindre admin_secret_audit_log aux admins seulement
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_secret_audit_log;
CREATE POLICY "Only admins can view secret audit logs"
ON public.admin_secret_audit_log
FOR SELECT
USING (public.is_admin());

-- AUDIT FIX: Recréer client_payment_history avec security_invoker
DROP VIEW IF EXISTS public.client_payment_history;
CREATE VIEW public.client_payment_history
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    COALESCE(p.client_id, p.user_id) AS client_id,
    p.invoice_id,
    p.billing_id,
    p.order_id,
    p.amount,
    p.payment_method,
    p.reference_number,
    p.status,
    p.source,
    p.captured_at,
    p.created_at,
    p.created_by_name,
    p.created_by_role,
    b.invoice_number,
    b.balance_due AS invoice_balance_due,
    b.status AS invoice_status
FROM payments p
LEFT JOIN billing b ON b.id = COALESCE(p.invoice_id, p.billing_id)
ORDER BY p.created_at DESC;

-- AUDIT FIX: Ajouter trigger pour sync balance_due dans billing quand payment est fait
CREATE OR REPLACE FUNCTION public.sync_billing_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quand un payment est ajouté/modifié avec billing_id ou invoice_id
  IF NEW.billing_id IS NOT NULL OR NEW.invoice_id IS NOT NULL THEN
    UPDATE public.billing
    SET 
      balance_due = GREATEST(0, amount - COALESCE(amount_paid, 0) - NEW.amount),
      amount_paid = COALESCE(amount_paid, 0) + NEW.amount,
      status = CASE 
        WHEN (amount - COALESCE(amount_paid, 0) - NEW.amount) <= 0 THEN 'paid'
        WHEN (COALESCE(amount_paid, 0) + NEW.amount) > 0 THEN 'partial'
        ELSE status
      END,
      paid_at = CASE 
        WHEN (amount - COALESCE(amount_paid, 0) - NEW.amount) <= 0 THEN COALESCE(paid_at, now())
        ELSE paid_at
      END
    WHERE id = COALESCE(NEW.billing_id, NEW.invoice_id)
      AND NEW.status = 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur payments
DROP TRIGGER IF EXISTS trg_sync_billing_on_payment ON public.payments;
CREATE TRIGGER trg_sync_billing_on_payment
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_billing_balance_on_payment();