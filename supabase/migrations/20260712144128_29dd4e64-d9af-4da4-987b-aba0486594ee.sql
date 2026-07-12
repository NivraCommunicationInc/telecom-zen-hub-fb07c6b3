
CREATE OR REPLACE FUNCTION public.fn_forbid_direct_billing_subscription_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text;
  v_role   text := current_user::text;
BEGIN
  BEGIN
    v_bypass := current_setting('app.canonical_subscription_writer', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF v_role IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type IS NULL
     OR NEW.source_id IS NULL
     OR NEW.source_order_item_id IS NULL
  THEN
    RAISE EXCEPTION
      'DIRECT_BILLING_SUBSCRIPTION_WRITE_FORBIDDEN: Use canonical subscription creation flow.'
      USING ERRCODE = 'P0001',
            HINT   = 'Route the insert through create_subscriptions_from_order() or provision_services_for_order() (SECURITY DEFINER).';
  END IF;

  RETURN NEW;
END;
$$;
