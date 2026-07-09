
CREATE OR REPLACE FUNCTION public.fn_notify_order_tracking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Only fire for notifiable transitions
  IF v_new NOT IN (
    'in_transit','in-transit','shipped','picked_up','accepted','en_route',
    'out_for_delivery','out-for-delivery','delivering','en_livraison'
  ) THEN
    RETURN NEW;
  END IF;

  -- Fetch Supabase URL + anon key from settings (must be configured in project)
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
  -- Never block the update because of a notification failure
  RAISE WARNING 'fn_notify_order_tracking_status failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_tracking_status_notify ON public.orders;
CREATE TRIGGER trg_orders_tracking_status_notify
AFTER UPDATE OF tracking_status ON public.orders
FOR EACH ROW
WHEN (NEW.tracking_status IS DISTINCT FROM OLD.tracking_status)
EXECUTE FUNCTION public.fn_notify_order_tracking_status();
