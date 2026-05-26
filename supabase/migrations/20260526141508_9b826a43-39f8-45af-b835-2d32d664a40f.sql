
CREATE OR REPLACE FUNCTION public.create_core_ticket_for_replacement_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_client_name text;
  v_account_id uuid;
  v_account_number text;
  v_subject text;
  v_description text;
BEGIN
  SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Client')
    INTO v_client_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;
  v_client_name := COALESCE(v_client_name, 'Client');

  SELECT o.account_id INTO v_account_id
  FROM public.orders o
  WHERE o.id = NEW.linked_order_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    SELECT a.account_number INTO v_account_number
    FROM public.accounts a WHERE a.id = v_account_id LIMIT 1;
  END IF;

  v_subject := 'Demande de remplacement équipement — ' || COALESCE(NEW.ticket_number, NEW.id::text);
  v_description := concat_ws(E'\n',
    'Demande client créée depuis le portail en ligne.',
    'Référence: ' || COALESCE(NEW.ticket_number, NEW.id::text),
    'Client: ' || v_client_name,
    'Courriel: ' || COALESCE(NEW.client_email, 'non fourni'),
    'Compte: ' || COALESCE(v_account_number, v_account_id::text, 'non lié'),
    'Commande: ' || COALESCE(NEW.linked_order_number, NEW.linked_order_id::text, '—'),
    'Équipement: ' || COALESCE(NEW.equipment_name, NEW.equipment_id, '—'),
    'Série: ' || COALESCE(NEW.equipment_serial, '—'),
    'Raison: ' || COALESCE(NEW.reason::text, '—'),
    'Détails: ' || COALESCE(NULLIF(BTRIM(NEW.reason_details), ''), '—'),
    'Adresse préférée: ' || COALESCE(NULLIF(BTRIM(NEW.preferred_address), ''), '—'),
    'Ville: ' || COALESCE(NEW.preferred_city, '—'),
    'Code postal: ' || COALESCE(NEW.preferred_postal_code, '—')
  );

  INSERT INTO public.support_tickets (
    user_id, owner_user_id, account_id, client_email, client_name,
    subject, description, body, status, priority, category, issue_type,
    source, is_internal, route_to, assigned_department,
    related_order_id, related_order_reference, equipment_serial,
    created_by_user_id, created_by_role
  )
  SELECT
    NEW.user_id, NEW.user_id, v_account_id, NEW.client_email, v_client_name,
    v_subject, v_description, v_description, 'open', 'normal', 'replacement', 'equipment_replacement',
    'web', true, 'oneview_cs', 'support',
    NEW.linked_order_id, 'RPL:' || COALESCE(NEW.ticket_number, NEW.id::text), NEW.equipment_serial,
    NEW.user_id, 'client'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.related_order_reference = 'RPL:' || COALESCE(NEW.ticket_number, NEW.id::text)
  );

  IF NEW.client_email IS NOT NULL AND NULLIF(BTRIM(NEW.client_email), '') IS NOT NULL THEN
    INSERT INTO public.email_queue (
      event_key, to_email, template_key, template_vars, status,
      attempts, max_attempts, entity_type, entity_id, language
    ) VALUES (
      'replacement_request_received_' || NEW.id::text,
      NEW.client_email,
      'replacement_request_received',
      jsonb_build_object(
        'client_name', v_client_name,
        'ticket_number', COALESCE(NEW.ticket_number, NEW.id::text),
        'equipment_name', COALESCE(NEW.equipment_name, 'votre équipement'),
        'equipment_serial', COALESCE(NEW.equipment_serial, ''),
        'reason', COALESCE(NEW.reason::text, ''),
        'account_number', COALESCE(v_account_number, ''),
        'portal_url', 'https://nivra-telecom.ca/portal/replacement'
      ),
      'queued', 0, 5, 'replacement_ticket', NEW.id::text, 'fr'
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_core_ticket_for_replacement_ticket ON public.replacement_tickets;
CREATE TRIGGER trg_create_core_ticket_for_replacement_ticket
AFTER INSERT ON public.replacement_tickets
FOR EACH ROW
EXECUTE FUNCTION public.create_core_ticket_for_replacement_ticket();

-- Backfill rétroactif
INSERT INTO public.support_tickets (
  user_id, owner_user_id, account_id, client_email, client_name,
  subject, description, body, status, priority, category, issue_type,
  source, is_internal, route_to, assigned_department,
  related_order_id, related_order_reference, equipment_serial,
  created_by_user_id, created_by_role, created_at
)
SELECT
  rt.user_id, rt.user_id,
  (SELECT o.account_id FROM public.orders o WHERE o.id = rt.linked_order_id LIMIT 1),
  rt.client_email,
  COALESCE((SELECT NULLIF(BTRIM(p.full_name),'') FROM public.profiles p WHERE p.user_id = rt.user_id LIMIT 1), 'Client'),
  'Demande de remplacement équipement — ' || COALESCE(rt.ticket_number, rt.id::text),
  concat_ws(E'\n','Backfill — demande de remplacement','Référence: ' || COALESCE(rt.ticket_number, rt.id::text),'Équipement: ' || COALESCE(rt.equipment_name,'—'),'Série: ' || COALESCE(rt.equipment_serial,'—'),'Raison: ' || COALESCE(rt.reason::text,'—')),
  'Backfill — demande de remplacement (réf ' || COALESCE(rt.ticket_number, rt.id::text) || ')',
  'open','normal','replacement','equipment_replacement',
  'web', true, 'oneview_cs', 'support',
  rt.linked_order_id, 'RPL:' || COALESCE(rt.ticket_number, rt.id::text), rt.equipment_serial,
  rt.user_id, 'client', rt.created_at
FROM public.replacement_tickets rt
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_tickets st
  WHERE st.related_order_reference = 'RPL:' || COALESCE(rt.ticket_number, rt.id::text)
);
