-- Trigger to unlock field sales commissions when order reaches 'activated' status
CREATE OR REPLACE FUNCTION public.trg_unlock_field_commission_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes TO 'activated'
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    -- Update sales_commissions linked to this order from pending_activation to pending (approved for payout)
    UPDATE public.sales_commissions
    SET status = 'validated',
        validated_at = now(),
        notes = COALESCE(notes, '') || ' | Débloquée automatiquement à l''activation'
    WHERE converted_order_id = NEW.id
      AND status = 'pending_activation';
    
    IF FOUND THEN
      RAISE LOG '[commission-unlock] Commission unlocked for order %', NEW.id;
    END IF;
  END IF;

  -- Handle cancellation: clawback commission
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.sales_commissions
    SET status = 'rejected',
        rejection_reason = 'Commande annulée',
        notes = COALESCE(notes, '') || ' | Rejetée: commande annulée'
    WHERE converted_order_id = NEW.id
      AND status IN ('pending_activation', 'pending', 'validated');
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS trg_unlock_field_commission ON public.orders;
CREATE TRIGGER trg_unlock_field_commission
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_unlock_field_commission_on_activation();