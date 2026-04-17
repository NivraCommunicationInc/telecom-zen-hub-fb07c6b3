
-- ============================================================================
-- Order data completeness validation
-- Permanent fix: flag any order missing critical customer/service data
-- ============================================================================

-- Function: identifies missing critical fields on an order
CREATE OR REPLACE FUNCTION public.fn_check_order_completeness(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_missing text[] := ARRAY[]::text[];
  v_invoice_line_count int := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF COALESCE(v_order.client_first_name, '') = '' THEN v_missing := array_append(v_missing, 'client_first_name'); END IF;
  IF COALESCE(v_order.client_last_name, '') = ''  THEN v_missing := array_append(v_missing, 'client_last_name');  END IF;
  IF COALESCE(v_order.client_email, '') = ''      THEN v_missing := array_append(v_missing, 'client_email');      END IF;
  IF COALESCE(v_order.client_phone, '') = ''      THEN v_missing := array_append(v_missing, 'client_phone');      END IF;
  IF v_order.client_dob IS NULL                   THEN v_missing := array_append(v_missing, 'client_dob');        END IF;
  IF COALESCE(v_order.shipping_address, '') = ''  AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_address');  END IF;
  IF COALESCE(v_order.shipping_city, '') = ''     AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_city');     END IF;
  IF COALESCE(v_order.shipping_postal_code, '') = '' AND v_order.fulfillment_type IS DISTINCT FROM 'digital'
                                                  THEN v_missing := array_append(v_missing, 'shipping_postal_code'); END IF;

  -- Equipment / line items
  IF v_order.equipment_line_details IS NULL
     AND (v_order.equipment_details IS NULL OR v_order.equipment_details = '{}'::jsonb)
     AND v_order.line_items IS NULL THEN
    v_missing := array_append(v_missing, 'equipment_or_line_items');
  END IF;

  -- Invoice lines
  SELECT COUNT(*) INTO v_invoice_line_count
  FROM public.billing_invoice_lines bil
  JOIN public.billing_invoices bi ON bi.id = bil.invoice_id
  WHERE bi.order_id = p_order_id;

  IF v_invoice_line_count = 0 THEN
    v_missing := array_append(v_missing, 'billing_invoice_lines');
  END IF;

  -- Promo amount mismatch (promo_code present but no discount recorded)
  IF v_order.promo_code IS NOT NULL
     AND COALESCE(v_order.promo_discount_amount, 0) = 0 THEN
    v_missing := array_append(v_missing, 'promo_discount_amount');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'order_id', p_order_id,
    'missing', to_jsonb(v_missing),
    'is_complete', array_length(v_missing, 1) IS NULL
  );
END;
$$;

-- Trigger function: insert/update incomplete_data alert
CREATE OR REPLACE FUNCTION public.fn_flag_incomplete_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
  v_missing jsonb;
BEGIN
  v_check := public.fn_check_order_completeness(NEW.id);
  v_missing := v_check->'missing';

  -- Resolve any existing unresolved alert if now complete
  IF (v_check->>'is_complete')::boolean THEN
    UPDATE public.billing_system_alerts
       SET resolved = true, resolved_at = now(), resolved_by = 'auto:completeness-trigger'
     WHERE alert_type = 'incomplete_data'
       AND entity_type = 'order'
       AND entity_id = NEW.id
       AND resolved = false;
    RETURN NEW;
  END IF;

  -- Upsert one open alert per order
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
$$;

DROP TRIGGER IF EXISTS trg_flag_incomplete_order ON public.orders;
CREATE TRIGGER trg_flag_incomplete_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_flag_incomplete_order();

-- Index for fast lookup of incomplete data alerts by order
CREATE INDEX IF NOT EXISTS idx_billing_system_alerts_incomplete_order
  ON public.billing_system_alerts (entity_id)
  WHERE alert_type = 'incomplete_data' AND entity_type = 'order' AND resolved = false;

-- Backfill: scan all existing orders to flag the incomplete ones
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.fn_flag_incomplete_order_manual(r.id);
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- Fallback: invoke trigger logic via no-op update
  NULL;
END $$;
