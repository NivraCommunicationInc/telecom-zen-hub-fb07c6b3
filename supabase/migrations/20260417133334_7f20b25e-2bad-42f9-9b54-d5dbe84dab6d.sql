-- Move unaccent to extensions schema if needed, ensure it's reachable
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Fix normalize_address: fully-qualify unaccent and set search_path
CREATE OR REPLACE FUNCTION public.normalize_address(
  p_address_line text,
  p_city text,
  p_province text,
  p_postal_code text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(regexp_replace(trim(
    extensions.unaccent(
      coalesce(p_address_line, '') || '|' ||
      coalesce(p_city, '') || '|' ||
      coalesce(p_province, '') || '|' ||
      regexp_replace(coalesce(p_postal_code, ''), '\s', '', 'g')
    )
  ), '\s+', ' ', 'g'));
$$;

-- Fix fn_ensure_subscription_on_invoice_paid: entity_id is UUID, not text
CREATE OR REPLACE FUNCTION public.fn_ensure_subscription_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub_exists boolean;
  v_result jsonb;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.order_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.billing_subscriptions
      WHERE order_id = NEW.order_id
    ) INTO v_sub_exists;

    IF NOT v_sub_exists THEN
      BEGIN
        v_result := public.provision_services_for_order(NEW.order_id);
      EXCEPTION WHEN OTHERS THEN
        v_result := jsonb_build_object('success', false, 'error', SQLERRM);
      END;

      IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
        INSERT INTO public.billing_system_alerts (
          alert_type, entity_type, entity_id, entity_reference, details
        ) VALUES (
          'subscription_auto_provision_failed',
          'invoice',
          NEW.id,
          NEW.invoice_number,
          jsonb_build_object(
            'invoice_number', NEW.invoice_number,
            'order_id', NEW.order_id,
            'error', v_result->>'error',
            'message', v_result->>'message',
            'trigger', 'fn_ensure_subscription_on_invoice_paid'
          )
        );
        RAISE WARNING '[subscription-guarantee] Auto-provision failed for order % (invoice %): %',
          NEW.order_id, NEW.invoice_number, v_result->>'error';
      ELSE
        RAISE NOTICE '[subscription-guarantee] ✓ Auto-provisioned subscription for order % via invoice %',
          NEW.order_id, NEW.invoice_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;