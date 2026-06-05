-- Notification staff quand un CLIENT soumet une demande de résiliation
-- Déclenche une staff_notification pour alerter l'équipe Nivra en temps réel.

-- ── 1. Étendre l'enum ────────────────────────────────────────────────────────
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'cancellation_requested';

-- ── 2. Trigger ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_cancellation_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name  text;
  v_client_email text;
  v_service_label text;
BEGIN
  -- Seulement quand initié par le client (pas par un admin)
  IF NEW.created_by_role IS DISTINCT FROM 'client' THEN RETURN NEW; END IF;

  SELECT full_name, email
  INTO v_client_name, v_client_email
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  v_service_label := CASE NEW.service_type
    WHEN 'mobile'    THEN 'Mobile'
    WHEN 'internet'  THEN 'Internet'
    WHEN 'tv'        THEN 'Télévision'
    WHEN 'streaming' THEN 'Streaming'
    WHEN 'security'  THEN 'Sécurité'
    WHEN 'bundle'    THEN 'Forfait combiné'
    ELSE COALESCE(NEW.service_type, 'Service')
  END;

  INSERT INTO public.staff_notifications (
    notification_type, title, message,
    entity_type, entity_id, entity_number,
    client_id, client_name, client_email
  ) VALUES (
    'cancellation_requested',
    'Demande de résiliation',
    v_service_label || ' — résiliation demandée par ' || COALESCE(v_client_name, 'client inconnu') ||
      CASE
        WHEN NEW.reason_code IS NOT NULL THEN ' (' || REPLACE(NEW.reason_code, '_', ' ') || ')'
        ELSE ''
      END,
    'cancellation', NEW.id, NEW.request_number,
    NEW.user_id, v_client_name, v_client_email
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancellation_request_notify ON public.service_cancellation_requests;
CREATE TRIGGER cancellation_request_notify
  AFTER INSERT ON public.service_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_cancellation_requested();
