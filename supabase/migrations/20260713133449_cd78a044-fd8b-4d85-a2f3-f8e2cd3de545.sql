
CREATE OR REPLACE FUNCTION public.fn_notify_order_tracking_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new text;
  v_old text;
  v_url text;
  v_anon text;
BEGIN
  v_new := lower(coalesce(NEW.tracking_status, ''));
  v_old := lower(coalesce(OLD.tracking_status, ''));

  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- Notifiable transitions (Phase 4): in_transit, out_for_delivery, delivered
  IF v_new NOT IN (
    'in_transit','in-transit','shipped','picked_up','accepted','en_route',
    'out_for_delivery','out-for-delivery','delivering','en_livraison',
    'delivered','livre','livré','livree','livrée'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    v_anon := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;

  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://xtgngmtxggascbxnswvb.supabase.co';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/order-tracking-status-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, current_setting('app.settings.anon_key', true), '')
    ),
    body := jsonb_build_object(
      'order_id', NEW.id,
      'tracking_status', NEW.tracking_status,
      'carrier', NEW.carrier,
      'tracking_number', NEW.tracking_number,
      'tracking_url', NEW.tracking_url
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_notify_order_tracking_status failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Ensure Realtime replicates tracking updates so Core UI reflects them live
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
