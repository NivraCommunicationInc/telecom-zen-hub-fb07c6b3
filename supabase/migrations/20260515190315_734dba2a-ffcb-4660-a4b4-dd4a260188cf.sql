-- FIX 1: orders.status change trigger (commission approve/clawback + auto-create on activation)
CREATE OR REPLACE FUNCTION public.fn_orders_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_amount numeric;
BEGIN
  -- Activation: approve pending commissions, create one if missing for field_sales agent
  IF NEW.status = 'activated' AND COALESCE(OLD.status, '') <> 'activated' THEN
    UPDATE public.field_commissions
    SET status = 'approved',
        approved_at = now()
    WHERE order_id = NEW.id
      AND status = 'pending';

    IF NEW.created_by_agent_id IS NOT NULL
       AND public.has_role(NEW.created_by_agent_id, 'field_sales')
       AND NOT EXISTS (
         SELECT 1 FROM public.field_commissions WHERE order_id = NEW.id
       )
    THEN
      SELECT COALESCE(
        (SELECT total_amount FROM public.field_sales_orders
          WHERE converted_order_id = NEW.id LIMIT 1),
        NEW.total_amount,
        0
      ) INTO v_base_amount;

      INSERT INTO public.field_commissions (
        agent_id, order_id, amount, status, commission_type,
        description, earned_at, approved_at, clawback_eligible_until
      ) VALUES (
        NEW.created_by_agent_id,
        NEW.id,
        ROUND((v_base_amount * 0.30)::numeric, 2),
        'approved',
        'forfait',
        'Commission vente terrain — ' || COALESCE(NEW.order_number, NEW.id::text),
        now(),
        now(),
        now() + INTERVAL '30 days'
      );
    END IF;
  END IF;

  -- Cancellation: clawback if still in window
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    UPDATE public.field_commissions
    SET status = 'clawback',
        clawback_reason = 'Commande annulée',
        clawback_at = now()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'approved')
      AND (clawback_eligible_until IS NULL OR clawback_eligible_until >= now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_change ON public.orders;
CREATE TRIGGER trg_orders_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.fn_orders_status_change();

-- FIX 2: sales_targets dedupe + unique constraint
DELETE FROM public.sales_targets
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, service_type, period_month, period_year) id
  FROM public.sales_targets
  ORDER BY employee_id, service_type, period_month, period_year, target_count DESC, target_amount DESC, created_at DESC
);

ALTER TABLE public.sales_targets
  DROP CONSTRAINT IF EXISTS sales_targets_unique;

ALTER TABLE public.sales_targets
  ADD CONSTRAINT sales_targets_unique
  UNIQUE (employee_id, service_type, period_month, period_year);