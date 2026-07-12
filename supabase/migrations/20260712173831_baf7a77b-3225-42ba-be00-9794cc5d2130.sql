-- BUG-CORE-001 Phase 4: silence incomplete_data alerts strictly for field pre-payment shells.
-- Any other incomplete order still fires the alert.
CREATE OR REPLACE FUNCTION public.fn_flag_incomplete_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_check jsonb;
  v_missing jsonb;
  v_is_field_shell boolean;
BEGIN
  -- Strict exception: field agent shell BEFORE payment. No masking of real issues.
  v_is_field_shell := (
    COALESCE(NEW.status::text, '') = 'pending'
    AND COALESCE(NEW.payment_status::text, '') = 'pending'
    AND COALESCE(NEW.source, '') LIKE 'field%'
  );

  IF v_is_field_shell THEN
    -- Auto-resolve any pre-existing alert for this shell so the noise disappears.
    UPDATE public.billing_system_alerts
       SET resolved = true, resolved_at = now(), resolved_by = 'auto:field-shell-exception'
     WHERE alert_type = 'incomplete_data'
       AND entity_type = 'order'
       AND entity_id = NEW.id
       AND resolved = false;
    RETURN NEW;
  END IF;

  v_check := public.fn_check_order_completeness(NEW.id);
  v_missing := v_check->'missing';

  IF (v_check->>'is_complete')::boolean THEN
    UPDATE public.billing_system_alerts
       SET resolved = true, resolved_at = now(), resolved_by = 'auto:completeness-trigger'
     WHERE alert_type = 'incomplete_data'
       AND entity_type = 'order'
       AND entity_id = NEW.id
       AND resolved = false;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.billing_system_alerts
     WHERE alert_type = 'incomplete_data'
       AND entity_type = 'order'
       AND entity_id = NEW.id
       AND resolved = false
  ) THEN
    UPDATE public.billing_system_alerts
       SET details = jsonb_build_object('missing', v_missing, 'order_id', NEW.id, 'order_number', NEW.order_number),
           entity_reference = NEW.order_number
     WHERE alert_type = 'incomplete_data'
       AND entity_type = 'order'
       AND entity_id = NEW.id
       AND resolved = false;
  ELSE
    INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, entity_reference, details, resolved)
    VALUES ('incomplete_data', 'order', NEW.id, NEW.order_number,
            jsonb_build_object('missing', v_missing, 'order_id', NEW.id, 'order_number', NEW.order_number), false);
  END IF;

  RETURN NEW;
END;
$function$;