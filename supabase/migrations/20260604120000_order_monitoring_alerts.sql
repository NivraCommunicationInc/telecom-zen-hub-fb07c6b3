-- ORDER MONITORING ALERTS
-- Adds real-time alerts for:
--   1. provisioning_failed  → staff_notification type 'order_failed'
--   2. hold                 → staff_notification type 'order_on_hold'
--   3. stalled > 48h        → staff_notification type 'order_stalled' (via cron)

-- ── 1. Extend enum ───────────────────────────────────────────────────────────
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'order_failed';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'order_on_hold';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'order_stalled';

-- ── 2. Trigger: notify on critical order status changes ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name  text;
  v_client_email text;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  -- Resolve client info
  SELECT full_name, email
  INTO v_client_name, v_client_email
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF NEW.status = 'provisioning_failed' THEN
    INSERT INTO public.staff_notifications (
      notification_type, title, message,
      entity_type, entity_id, entity_number,
      client_id, client_name, client_email
    ) VALUES (
      'order_failed',
      'Échec de provisionnement',
      'Commande ' || COALESCE(NEW.order_number, 'N/A') || ' — provisionnement échoué pour ' ||
        COALESCE(v_client_name, 'client inconnu'),
      'order', NEW.id, NEW.order_number,
      NEW.user_id, v_client_name, v_client_email
    );

  ELSIF NEW.status = 'hold' THEN
    INSERT INTO public.staff_notifications (
      notification_type, title, message,
      entity_type, entity_id, entity_number,
      client_id, client_name, client_email
    ) VALUES (
      'order_on_hold',
      'Commande mise en attente',
      'Commande ' || COALESCE(NEW.order_number, 'N/A') || ' suspendue (hold) pour ' ||
        COALESCE(v_client_name, 'client inconnu'),
      'order', NEW.id, NEW.order_number,
      NEW.user_id, v_client_name, v_client_email
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_notify ON public.orders;
CREATE TRIGGER orders_status_notify
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_order_status_change();

-- ── 3. pg_cron: check stalled orders every 4 hours ──────────────────────────
SELECT cron.schedule(
  'order-stall-monitor-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/order-stall-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron_4h')
  ) AS request_id;
  $$
);
