-- Fusionner la logique balance + auto-paid dans un seul trigger robuste
CREATE OR REPLACE FUNCTION public.sync_billing_invoice_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Calculer balance_due
  NEW.balance_due := COALESCE(NEW.total, 0) + COALESCE(NEW.fees, 0) - COALESCE(NEW.amount_paid, 0);
  
  -- 2. Clamp négatif
  IF NEW.balance_due < 0 THEN
    NEW.balance_due := 0;
  END IF;
  
  -- 3. Auto-transition to paid when fully paid
  IF NEW.status IN ('pending', 'overdue')
     AND NEW.balance_due <= 0 THEN
    NEW.status := 'paid';
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Supprimer le trigger séparé (logique fusionnée)
DROP TRIGGER IF EXISTS trg_auto_mark_invoice_paid ON public.billing_invoices;
DROP FUNCTION IF EXISTS public.auto_mark_invoice_paid();