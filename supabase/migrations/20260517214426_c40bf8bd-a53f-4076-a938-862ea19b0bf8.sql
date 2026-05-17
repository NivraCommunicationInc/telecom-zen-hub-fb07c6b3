
-- ============================================================
-- FEATURE 2 — service_incidents: client reporting
-- ============================================================
ALTER TABLE public.service_incidents
  ADD COLUMN IF NOT EXISTS reported_by_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_account_id uuid,
  ADD COLUMN IF NOT EXISTS client_user_id uuid,
  ADD COLUMN IF NOT EXISTS client_description text,
  ADD COLUMN IF NOT EXISTS incident_type text,
  ADD COLUMN IF NOT EXISTS related_ticket_id uuid;

-- Ensure RLS enabled (don't change existing policies)
ALTER TABLE public.service_incidents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated clients to insert their own client-reported incident
DROP POLICY IF EXISTS "clients_insert_own_outage_report" ON public.service_incidents;
CREATE POLICY "clients_insert_own_outage_report"
ON public.service_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  reported_by_client = true
  AND client_user_id = auth.uid()
);

-- Allow clients to view their own reported incidents
DROP POLICY IF EXISTS "clients_view_own_outage_reports" ON public.service_incidents;
CREATE POLICY "clients_view_own_outage_reports"
ON public.service_incidents
FOR SELECT
TO authenticated
USING (
  reported_by_client = true
  AND client_user_id = auth.uid()
);

-- ============================================================
-- FEATURE 1 — Extended order status trigger (email + SMS)
-- Adds confirmed/delivered/activated; switches to generic
-- 'order_status_update' template; fires SMS via pg_net.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_order_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_client_email TEXT;
  v_client_name  TEXT;
  v_client_phone TEXT;
  v_status_label TEXT;
  v_event_key    TEXT;
  v_func_url     TEXT;
  v_anon_key     TEXT;
BEGIN
  -- Only on real status changes
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT email, COALESCE(full_name, 'Client'), phone
    INTO v_client_email, v_client_name, v_client_phone
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;

  v_status_label := CASE NEW.status
    WHEN 'confirmed'              THEN 'Commande confirmée'
    WHEN 'processing'             THEN 'En préparation'
    WHEN 'processed'              THEN 'Préparée'
    WHEN 'shipped'                THEN 'Expédiée'
    WHEN 'delivered'              THEN 'Livrée'
    WHEN 'completed'              THEN 'Terminée'
    WHEN 'completed_installation' THEN 'Installation terminée'
    WHEN 'activated'              THEN 'Service activé'
    WHEN 'cancelled'              THEN 'Commande annulée'
    ELSE NULL
  END;

  IF v_status_label IS NULL THEN
    RETURN NEW;
  END IF;

  v_event_key := 'order_status_' || NEW.id::TEXT || '_' || NEW.status;

  -- Queue email via canonical helper using generic template
  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    'order_status_update',
    jsonb_build_object(
      'client_name',     v_client_name,
      'order_id',        NEW.id,
      'order_number',    COALESCE(NEW.order_number, NEW.confirmation_number),
      'service_type',    NEW.service_type,
      'status',          NEW.status,
      'status_label',    v_status_label,
      'tracking_number', COALESCE(NEW.tracking_number, ''),
      'carrier',         COALESCE(NEW.carrier, ''),
      'total_amount',    COALESCE(NEW.total_amount, 0)
    )
  );

  -- Fire SMS via pg_net (fire-and-forget) if phone present
  IF v_client_phone IS NOT NULL AND length(v_client_phone) > 0 THEN
    BEGIN
      SELECT decrypted_secret INTO v_func_url
      FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
      SELECT decrypted_secret INTO v_anon_key
      FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;

      IF v_func_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url     := v_func_url || '/functions/v1/order-status-sms',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer ' || v_anon_key
          ),
          body    := jsonb_build_object(
            'order_id',      NEW.id,
            'phone',         v_client_phone,
            'status',        NEW.status,
            'status_label',  v_status_label,
            'order_number',  COALESCE(NEW.order_number, NEW.confirmation_number),
            'tracking_number', COALESCE(NEW.tracking_number, ''),
            'event_key',     v_event_key
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Never block status update if SMS dispatch fails
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- FEATURE 4 — SLA breach / warning notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_sla_status_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_admin_email TEXT;
  v_assignee_email TEXT;
  v_assignee_name TEXT;
  v_template TEXT;
  v_event_key TEXT;
  v_title TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.sla_status IS NOT DISTINCT FROM OLD.sla_status THEN
    RETURN NEW;
  END IF;
  IF NEW.sla_status NOT IN ('breached','at_risk') THEN
    RETURN NEW;
  END IF;

  -- Determine template
  IF NEW.sla_status = 'breached' THEN
    v_template := 'sla_breach_alert';
    v_title    := 'SLA dépassé';
  ELSE
    v_template := 'sla_warning';
    v_title    := 'SLA bientôt expiré';
  END IF;
  v_event_key := 'sla_' || NEW.id::TEXT || '_' || NEW.sla_status;

  -- Assignee email (best effort)
  IF NEW.assigned_to_id IS NOT NULL THEN
    SELECT p.email, COALESCE(p.full_name,'Employé')
      INTO v_assignee_email, v_assignee_name
    FROM public.profiles p WHERE p.user_id = NEW.assigned_to_id;

    IF v_assignee_email IS NOT NULL THEN
      PERFORM public.queue_email(
        v_event_key || '_assignee',
        v_assignee_email,
        v_template,
        jsonb_build_object(
          'employee_name', v_assignee_name,
          'item_type',     NEW.item_type,
          'item_reference',NEW.source_reference,
          'client_name',   NEW.client_name,
          'sla_deadline',  NEW.sla_deadline_at,
          'sla_status',    NEW.sla_status
        )
      );
    END IF;

    -- Notification
    INSERT INTO public.employee_notifications(
      user_id, notification_type, title, message, work_item_id, is_read, link_url
    ) VALUES (
      NEW.assigned_to_id,
      'sla_' || NEW.sla_status,
      v_title || ' — ' || NEW.item_type,
      COALESCE(NEW.client_name,'') || ' · échéance ' ||
        COALESCE(to_char(NEW.sla_deadline_at,'YYYY-MM-DD HH24:MI'),'?'),
      NEW.id,
      false,
      '/core/sla'
    );
  END IF;

  -- Admin alert
  v_admin_email := 'nivratelecom@gmail.com';
  PERFORM public.queue_email(
    v_event_key || '_admin',
    v_admin_email,
    v_template,
    jsonb_build_object(
      'employee_name', COALESCE(v_assignee_name,'(non assigné)'),
      'item_type',     NEW.item_type,
      'item_reference',NEW.source_reference,
      'client_name',   NEW.client_name,
      'sla_deadline',  NEW.sla_deadline_at,
      'sla_status',    NEW.sla_status,
      'admin_alert',   true
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sla_status_alert ON public.employee_work_items;
CREATE TRIGGER trg_sla_status_alert
AFTER UPDATE OF sla_status ON public.employee_work_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sla_status_alert();
