CREATE OR REPLACE FUNCTION public.fn_sync_order_installation_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _appt_id uuid;
  _start_time text;
  _scheduled_at timestamptz;
  _legacy_source_id uuid;
  _sync_status text;
BEGIN
  IF lower(coalesce(NEW.installation_type, '')) = 'auto'
     OR lower(coalesce(NEW.fulfillment_type, '')) = 'self_install' THEN
    UPDATE public.appointments
       SET status = 'cancelled',
           installation_method = 'auto',
           cancellation_reason = coalesce(cancellation_reason, 'Commande basculée en auto-installation'),
           updated_at = now()
     WHERE order_id = NEW.id
       AND coalesce(status, '') NOT IN ('cancelled', 'completed');
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.installation_type, '')) <> 'technician'
     AND lower(coalesce(NEW.fulfillment_type, '')) <> 'technician' THEN
    RETURN NEW;
  END IF;

  _scheduled_at := NEW.appointment_date;
  IF NEW.appointment_date IS NOT NULL
     AND coalesce(NEW.appointment_notes, '') ~ '^\d{2}:\d{2}-\d{2}:\d{2}$' THEN
    _start_time := split_part(NEW.appointment_notes, '-', 1);
    _scheduled_at := ((NEW.appointment_date::date::text || ' ' || _start_time || ':00')::timestamp AT TIME ZONE 'America/Toronto');
  END IF;

  SELECT fso.id INTO _legacy_source_id
  FROM public.field_sales_orders fso
  WHERE fso.converted_order_id = NEW.id
  ORDER BY fso.updated_at DESC NULLS LAST, fso.created_at DESC NULLS LAST
  LIMIT 1;

  IF _scheduled_at IS NULL AND _legacy_source_id IS NOT NULL THEN
    SELECT CASE
             WHEN fso.appointment_date IS NOT NULL THEN fso.appointment_date
             WHEN fso.install_date IS NOT NULL THEN (fso.install_date::date::text || ' 09:00:00')::timestamp AT TIME ZONE 'America/Toronto'
             ELSE NULL
           END
    INTO _scheduled_at
    FROM public.field_sales_orders fso
    WHERE fso.id = _legacy_source_id;
  END IF;

  _sync_status := CASE WHEN _scheduled_at IS NULL THEN 'pending_scheduling' ELSE 'scheduled' END;

  _appt_id := public.fn_upsert_canonical_appointment_from_legacy(
    'orders',
    coalesce(_legacy_source_id, NEW.id),
    NEW.id,
    NEW.user_id,
    NEW.account_id,
    NEW.service_address_id,
    NEW.technician_id,
    _scheduled_at,
    _sync_status,
    coalesce(NEW.shipping_address, NEW.client_full_address),
    NEW.shipping_city,
    NEW.shipping_postal_code,
    NEW.client_email,
    NEW.client_phone,
    NEW.service_type,
    'Installation — ' || coalesce(NEW.order_number, NEW.id::text),
    concat_ws(E'\n', '[SYSTEM] Rendez-vous technicien synchronisé depuis la commande', NEW.appointment_notes)
  );

  RETURN NEW;
END;
$function$;