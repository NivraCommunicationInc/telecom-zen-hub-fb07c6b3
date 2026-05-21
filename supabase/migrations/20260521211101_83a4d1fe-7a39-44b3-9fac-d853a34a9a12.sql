CREATE OR REPLACE FUNCTION public.enforce_subscription_setup_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_service_type text;
  v_pricing_snapshot jsonb;
  v_is_recurring boolean := false;
  v_sub_id uuid;
  v_current_status public.recurring_setup_status;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    v_order_id := NEW.order_id;

    IF v_order_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT service_type, pricing_snapshot::jsonb
    INTO v_service_type, v_pricing_snapshot
    FROM public.orders
    WHERE id = v_order_id;

    IF v_service_type IS NOT NULL AND (
      v_service_type ILIKE '%internet%' OR
      v_service_type ILIKE '%mobile%' OR
      v_service_type ILIKE '%tv%' OR
      v_service_type ILIKE '%streaming%' OR
      v_service_type ILIKE '%security%'
    ) THEN
      v_is_recurring := true;
    END IF;

    IF v_pricing_snapshot IS NOT NULL AND (
      v_pricing_snapshot->>'plan_code' IS NOT NULL OR
      v_pricing_snapshot->>'service_category' IN ('internet','mobile','tv_combo','tv_pack','streaming','security')
    ) THEN
      v_is_recurring := true;
    END IF;

    IF v_is_recurring THEN
      SELECT id, recurring_setup_status INTO v_sub_id, v_current_status
      FROM public.billing_subscriptions
      WHERE order_id = v_order_id
      LIMIT 1;

      IF v_sub_id IS NOT NULL AND v_current_status IS NULL THEN
        UPDATE public.billing_subscriptions
        SET recurring_setup_status = 'pending'::public.recurring_setup_status,
            recurring_provider = COALESCE(recurring_provider, 'paypal'),
            updated_at = now()
        WHERE id = v_sub_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;