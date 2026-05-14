
-- 1. Unique constraint to allow two commission rows per order (forfait + equipment)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='field_commissions_order_type_uidx'
  ) THEN
    CREATE UNIQUE INDEX field_commissions_order_type_uidx
      ON public.field_commissions (order_id, commission_type)
      WHERE order_id IS NOT NULL;
  END IF;
END $$;

-- 2. Rebuild fn_calculate_field_commission to return TABLE breakdown
DROP FUNCTION IF EXISTS public.fn_calculate_field_commission(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_calculate_field_commission(
  p_order_id UUID,
  p_agent_id UUID
)
RETURNS TABLE(
  forfait_commission NUMERIC,
  equipment_commission NUMERIC,
  total_commission NUMERIC,
  forfait_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_forfait_comm NUMERIC := 0;
  v_equip_comm NUMERIC := 0;
  v_forfait_count INTEGER := 0;
  v_cat TEXT;
BEGIN
  FOR v_item IN
    SELECT oi.unit_price, oi.quantity, oi.service_type::text AS stype
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    v_cat := v_item.stype;

    -- Mobile: zero commission, skip
    IF v_cat = 'mobile' THEN
      CONTINUE;
    END IF;

    -- Forfait commission (30% on HT)
    IF v_cat IN ('internet','tv','bundle') THEN
      v_forfait_comm := v_forfait_comm + ROUND(COALESCE(v_item.unit_price, 0) * 0.30, 2);
      v_forfait_count := v_forfait_count + 1;

    -- Equipment commission (5% × qty on HT)
    ELSIF v_cat = 'equipment' THEN
      v_equip_comm := v_equip_comm +
        ROUND(COALESCE(v_item.unit_price, 0) * 0.05 * COALESCE(v_item.quantity, 1), 2);
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    v_forfait_comm,
    v_equip_comm,
    v_forfait_comm + v_equip_comm,
    v_forfait_count;
END;
$$;

-- 3. Update activation trigger to insert TWO commission rows (forfait + equipment)
CREATE OR REPLACE FUNCTION public.fn_create_commission_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_breakdown RECORD;
  v_order_label TEXT;
BEGIN
  IF NEW.status = 'activated'
     AND (OLD.status IS DISTINCT FROM 'activated')
     AND (NEW.created_by_agent_id IS NOT NULL OR NEW.source = 'field_sales') THEN

    v_agent_id := COALESCE(NEW.created_by_agent_id, NEW.created_by);

    IF v_agent_id IS NOT NULL AND public.has_role(v_agent_id, 'field_sales') THEN
      SELECT * INTO v_breakdown
      FROM public.fn_calculate_field_commission(NEW.id, v_agent_id);

      v_order_label := COALESCE(NEW.order_number, NEW.id::text);

      -- Forfait row
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

      -- Equipment row
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
$$;
