CREATE OR REPLACE FUNCTION public.create_core_ticket_for_equipment_return_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_account_number text;
  v_client_email text;
  v_client_name text;
  v_equipment_name text;
  v_equipment_serial text;
  v_subject text;
  v_description text;
BEGIN
  SELECT a.account_number INTO v_account_number
  FROM public.accounts a
  WHERE a.id = NEW.account_id
  LIMIT 1;

  SELECT p.email, p.full_name INTO v_client_email, v_client_name
  FROM public.profiles p
  WHERE p.user_id = NEW.client_user_id
  LIMIT 1;

  SELECT ei.catalog_name, ei.serial_number INTO v_equipment_name, v_equipment_serial
  FROM public.equipment_inventory ei
  WHERE ei.id = NEW.equipment_inventory_id
  LIMIT 1;

  v_client_name := COALESCE(NULLIF(BTRIM(v_client_name), ''), 'Client');
  v_subject := 'Retour / remplacement équipement — ' || NEW.id::text;
  v_description := concat_ws(E'\n',
    'Demande de retour/remplacement créée depuis le portail client.',
    'Référence RMA: ' || NEW.id::text,
    'Client: ' || v_client_name,
    'Courriel: ' || COALESCE(v_client_email, 'non fourni'),
    'Compte: ' || COALESCE(v_account_number, NEW.account_id::text, 'non lié'),
    'Équipement: ' || COALESCE(v_equipment_name, NEW.equipment_inventory_id::text, 'non précisé'),
    'Série: ' || COALESCE(v_equipment_serial, '—'),
    'Raison: ' || COALESCE(NEW.reason, '—'),
    'Détails: ' || COALESCE(NULLIF(BTRIM(NEW.reason_detail), ''), '—')
  );

  INSERT INTO public.support_tickets (
    user_id, owner_user_id, account_id, client_email, client_name,
    subject, description, body, status, priority, category, issue_type,
    source, is_internal, route_to, assigned_department,
    related_order_reference, equipment_serial, created_by_user_id, created_by_role
  )
  SELECT
    NEW.client_user_id, NEW.client_user_id, NEW.account_id, v_client_email, v_client_name,
    v_subject, v_description, v_description, 'open', 'normal', 'replacement', 'equipment_return_or_swap',
    'equipment_return_request', true, 'oneview_cs', 'support',
    NEW.id::text, v_equipment_serial, NEW.client_user_id, 'client'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.source = 'equipment_return_request'
      AND st.related_order_reference = NEW.id::text
  );

  IF v_client_email IS NOT NULL AND NULLIF(BTRIM(v_client_email), '') IS NOT NULL THEN
    INSERT INTO public.email_queue (
      event_key, to_email, template_key, template_vars, status,
      attempts, max_attempts, entity_type, entity_id, language
    ) VALUES (
      'equipment_return_request_received_' || NEW.id::text,
      v_client_email,
      'equipment_return_received',
      jsonb_build_object(
        'client_name', v_client_name,
        'request_id', NEW.id::text,
        'equipment_name', COALESCE(v_equipment_name, 'votre équipement'),
        'equipment_serial', COALESCE(v_equipment_serial, ''),
        'reason', COALESCE(NEW.reason, ''),
        'account_number', COALESCE(v_account_number, ''),
        'portal_url', 'https://nivra-telecom.ca/portal/equipment'
      ),
      'queued', 0, 5, 'equipment_return_request', NEW.id::text, 'fr'
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_core_ticket_for_equipment_return_request ON public.equipment_return_requests;
CREATE TRIGGER trg_create_core_ticket_for_equipment_return_request
AFTER INSERT ON public.equipment_return_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_core_ticket_for_equipment_return_request();

REVOKE EXECUTE ON FUNCTION public.create_core_ticket_for_equipment_return_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_core_ticket_for_equipment_return_request() TO service_role;