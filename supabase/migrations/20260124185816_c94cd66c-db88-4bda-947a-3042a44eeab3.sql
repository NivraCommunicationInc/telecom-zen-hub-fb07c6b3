-- ============================================================
-- V2 AUTO-PAID TRIGGER: Passage automatique à paid quand balance_due <= 0
-- ============================================================

-- 1) paid_at déjà présent, mais s'assurer qu'il existe
ALTER TABLE public.billing_invoices
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 2) Trigger function avec clamp négatif
CREATE OR REPLACE FUNCTION public.auto_mark_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clamp to prevent negative balance from rounding/overpayment
  IF NEW.balance_due IS NOT NULL AND NEW.balance_due < 0 THEN
    NEW.balance_due := 0;
  END IF;

  -- Auto-transition to paid when fully paid
  IF NEW.status IN ('pending','overdue')
     AND NEW.balance_due IS NOT NULL
     AND NEW.balance_due <= 0 THEN
    NEW.status := 'paid';
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Créer le trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_auto_mark_invoice_paid ON public.billing_invoices;

CREATE TRIGGER trg_auto_mark_invoice_paid
BEFORE UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_mark_invoice_paid();