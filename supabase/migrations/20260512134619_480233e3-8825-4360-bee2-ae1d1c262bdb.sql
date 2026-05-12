CREATE OR REPLACE FUNCTION public.fn_create_commission_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id UUID;
  v_commission NUMERIC;
BEGIN
  IF NEW.status = 'activated'
     AND (OLD.status IS DISTINCT FROM 'activated')
     AND (
       NEW.created_by_agent_id IS NOT NULL
       OR NEW.source = 'field_sales'
     ) THEN

    -- Resolve agent: prefer explicit created_by_agent_id, fall back to
    -- created_by when source flags this as a field-sales order. Only
    -- proceed when the resolved user actually carries the field_sales role.
    v_agent_id := COALESCE(NEW.created_by_agent_id, NEW.created_by);

    IF v_agent_id IS NOT NULL
       AND public.has_role(v_agent_id, 'field_sales') THEN

      v_commission := public.fn_calculate_field_commission(NEW.id, v_agent_id);

      IF v_commission > 0 THEN
        INSERT INTO public.field_commissions (
          agent_id, order_id, amount, status,
          commission_type, description,
          earned_at, clawback_eligible_until
        ) VALUES (
          v_agent_id, NEW.id, v_commission, 'pending',
          'sale',
          'Commission vente #' || COALESCE(NEW.order_number, NEW.id::text),
          now(), now() + INTERVAL '30 days'
        )
        ON CONFLICT (order_id, commission_type) DO NOTHING;

        INSERT INTO public.employee_notifications (
          user_id, notification_type, title, message, work_item_id, is_read
        ) VALUES (
          v_agent_id, 'system',
          'Nouvelle commission — ' || v_commission::text || ' $',
          'Votre commission de ' || v_commission::text ||
            ' $ pour la commande #' || COALESCE(NEW.order_number, NEW.id::text) ||
            ' est en attente de confirmation.',
          NEW.id, false
        );
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'completed' AND OLD.status = 'activated' THEN
    UPDATE public.field_commissions
       SET status = 'approved', approved_at = now()
     WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  IF NEW.status = 'cancelled' THEN
    UPDATE public.field_commissions
       SET status = 'clawback',
           clawback_reason = 'Commande annulée',
           clawback_at = now()
     WHERE order_id = NEW.id
       AND status IN ('pending','approved')
       AND (clawback_eligible_until IS NULL OR clawback_eligible_until >= now());
  END IF;

  RETURN NEW;
END;
$function$;