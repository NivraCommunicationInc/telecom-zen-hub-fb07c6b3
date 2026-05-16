CREATE OR REPLACE FUNCTION public.fn_create_commission_on_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id UUID;
  v_breakdown RECORD;
  v_order_label TEXT;
BEGIN
  IF NEW.status = 'activated'
     AND (OLD.status IS DISTINCT FROM 'activated')
     AND (NEW.created_by_agent_id IS NOT NULL OR NEW.source = 'field_sales') THEN

    v_agent_id := COALESCE(
      NEW.created_by_agent_id,
      CASE
        WHEN NEW.created_by ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN NEW.created_by::uuid
        ELSE NULL
      END
    );

    IF v_agent_id IS NOT NULL AND public.has_role(v_agent_id, 'field_sales') THEN
      SELECT * INTO v_breakdown
      FROM public.fn_calculate_field_commission(NEW.id, v_agent_id);

      v_order_label := COALESCE(NEW.order_number, NEW.id::text);

      IF v_breakdown.forfait_commission > 0 THEN
        INSERT INTO public.field_commissions (
          agent_id, order_id, amount, status, commission_type,
          description, earned_at, clawback_eligible_until
        ) VALUES (
          v_agent_id, NEW.id, v_breakdown.forfait_commission, 'pending', 'forfait',
          'Commission forfait — Commande #' || v_order_label,
          now(), now() + INTERVAL '30 days'
        )
        ON CONFLICT (order_id, commission_type) DO NOTHING;
      END IF;

      IF v_breakdown.equipment_commission > 0 THEN
        INSERT INTO public.field_commissions (
          agent_id, order_id, amount, status, commission_type,
          description, earned_at, clawback_eligible_until
        ) VALUES (
          v_agent_id, NEW.id, v_breakdown.equipment_commission, 'pending', 'equipment',
          'Commission équipement — Commande #' || v_order_label,
          now(), now() + INTERVAL '30 days'
        )
        ON CONFLICT (order_id, commission_type) DO NOTHING;
      END IF;

      IF v_breakdown.total_commission > 0 THEN
        INSERT INTO public.employee_notifications (
          user_id, notification_type, title, message, work_item_id, is_read
        ) VALUES (
          v_agent_id, 'system',
          'Nouvelle commission — ' || v_breakdown.total_commission::text || ' $',
          'Votre commission de ' || v_breakdown.total_commission::text ||
            ' $ pour la commande #' || v_order_label ||
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