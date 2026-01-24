-- Fix search_path for sync_invoice_amount_paid function
CREATE OR REPLACE FUNCTION sync_invoice_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer amount_paid = somme des paiements confirmés
  UPDATE public.billing_invoices
  SET amount_paid = COALESCE((
    SELECT SUM(amount) 
    FROM public.billing_payments 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
      AND status = 'confirmed'
  ), 0)
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;