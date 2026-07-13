CREATE OR REPLACE FUNCTION public.fn_normalize_appointment_service_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_account_id uuid;
BEGIN
  IF NEW.environment IS NULL OR lower(btrim(NEW.environment)) IN ('', 'production', 'prod') THEN
    NEW.environment := 'live';
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, o.client_email, o.client_phone, o.service_address_id,
           coalesce(o.shipping_address, o.shipping_address_line, o.client_full_address) AS addr,
           o.shipping_city AS city,
           o.shipping_postal_code AS postal,
           o.service_type
    INTO v_order
    FROM public.orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;

    IF FOUND THEN
      v_account_id := v_order.account_id;
      NEW.client_id := coalesce(NEW.client_id, v_order.user_id);
      NEW.client_email := coalesce(nullif(NEW.client_email, ''), v_order.client_email);
      NEW.client_phone := coalesce(nullif(NEW.client_phone, ''), v_order.client_phone);
      NEW.service_address := coalesce(nullif(NEW.service_address, ''), v_order.addr);
      NEW.service_city := coalesce(nullif(NEW.service_city, ''), v_order.city);
      NEW.service_postal_code := coalesce(nullif(NEW.service_postal_code, ''), v_order.postal);
      NEW.service_type := coalesce(nullif(NEW.service_type, ''), v_order.service_type, 'installation');
      NEW.service_address_id := coalesce(NEW.service_address_id, v_order.service_address_id);
    END IF;
  END IF;

  IF v_account_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.client_id = NEW.client_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF NEW.service_address_id IS NULL THEN
    NEW.service_address_id := public.fn_resolve_service_address_for_links(
      v_account_id,
      NEW.order_id,
      NEW.client_id,
      NEW.service_address,
      NEW.service_city,
      NEW.service_postal_code
    );
  END IF;

  RETURN NEW;
END;
$$;