-- Module 54.2 Phase 5.1 — Hard lock billing_subscriptions writes
-- Objective: no direct INSERT/UPDATE/DELETE by anon/authenticated/service_role.
-- Only explicit SECURITY DEFINER backend functions in the allow-list can mutate rows.

-- 1) Role-level lock: API roles keep read access only; all direct writes are revoked.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_subscriptions FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_subscriptions FROM service_role;

GRANT SELECT ON TABLE public.billing_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.billing_subscriptions TO service_role;

-- 2) Remove prior partial trigger versions.
DROP TRIGGER IF EXISTS trg_forbid_direct_billing_subscription_insert ON public.billing_subscriptions;
DROP TRIGGER IF EXISTS trg_enforce_billing_subscription_writer_lock ON public.billing_subscriptions;
DROP FUNCTION IF EXISTS public.fn_forbid_direct_billing_subscription_insert();
DROP FUNCTION IF EXISTS public.fn_enforce_billing_subscription_writer_lock();

-- 3) Explicit allow-list trigger. No GUC bypass, no service_role exemption.
CREATE OR REPLACE FUNCTION public.fn_enforce_billing_subscription_writer_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stack text := '';
  v_allowed_function text;
  v_allowed_functions text[] := ARRAY[
    -- Creation / provisioning canonical gateways
    'create_subscriptions_from_order',
    'provision_services_for_order',
    'create_subscription_ad_hoc',

    -- State-machine canonical gateways
    'cancel_subscription',
    'suspend_subscription',
    'reactivate_subscription',
    'renew_subscription',
    'apply_plan_change',
    'close_and_supersede_subscription',

    -- Existing backend-only automation triggers/functions that already execute inside the database
    'fn_activate_sub_on_order_activation',
    'fn_cancel_sub_on_order_cancel',
    'cancel_subscription_on_order_cancel',
    'update_subscription_on_invoice_paid',
    'billing_invoice_paid_trigger',
    'billing_invoice_failed_trigger',
    'enforce_subscription_setup_status',
    'fn_sync_last_invoice_id',
    'trg_sync_last_invoice_id',
    'fn_backfill_paid_invoice_subscription_link',
    'fn_create_reactivation_fee_on_payment',
    'client_resume_paused_service',
    'auto_resume_paused_services',
    'generate_account_renewal_invoice',
    'repair_order_client_portal_links'
  ];
BEGIN
  GET DIAGNOSTICS v_stack = PG_CONTEXT;

  FOREACH v_allowed_function IN ARRAY v_allowed_functions LOOP
    IF v_stack ILIKE '%' || v_allowed_function || '%' THEN
      -- Canonical writers must still preserve provenance for new subscriptions.
      IF TG_OP = 'INSERT' THEN
        IF NEW.source_type IS NULL OR NEW.source_id IS NULL THEN
          RAISE EXCEPTION 'CANONICAL_SUBSCRIPTION_METADATA_REQUIRED: source_type and source_id are required for billing_subscriptions inserts'
            USING ERRCODE = '42501',
                  HINT = 'Use create_subscriptions_from_order() or provision_services_for_order() with a source order item.';
        END IF;
      END IF;
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'DIRECT_BILLING_SUBSCRIPTION_INSERT_FORBIDDEN: route writes through canonical backend functions'
      USING ERRCODE = '42501',
            HINT = 'Use create_subscriptions_from_order() or provision_services_for_order(); direct writes are blocked for anon/authenticated/service_role.';
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'DIRECT_BILLING_SUBSCRIPTION_UPDATE_FORBIDDEN: route state changes through canonical backend functions'
      USING ERRCODE = '42501',
            HINT = 'Use suspend_subscription(), reactivate_subscription(), cancel_subscription(), apply_plan_change(), or another allow-listed backend function.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DIRECT_BILLING_SUBSCRIPTION_DELETE_FORBIDDEN: subscriptions are immutable outside canonical backend functions'
      USING ERRCODE = '42501',
            HINT = 'Use a canonical cancellation/supersession function; direct deletes are blocked.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION public.fn_enforce_billing_subscription_writer_lock() IS
'Module 54.2 Phase 5.1 writer lock. Blocks direct INSERT/UPDATE/DELETE on billing_subscriptions. No GUC bypass. No service_role exemption. Mutations are allowed only when the call stack contains an explicit canonical SECURITY DEFINER function.';

CREATE TRIGGER trg_enforce_billing_subscription_writer_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_billing_subscription_writer_lock();

COMMENT ON TRIGGER trg_enforce_billing_subscription_writer_lock ON public.billing_subscriptions IS
'Module 54.2 Phase 5.1: enforces canonical-only subscription writes across INSERT, UPDATE, and DELETE.';

-- 4) Re-assert canonical RPC execution grants while table writes remain revoked.
REVOKE ALL ON FUNCTION public.create_subscriptions_from_order(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscriptions_from_order(uuid,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.provision_services_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_services_for_order(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_subscription(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid,text,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.suspend_subscription(uuid,text,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_subscription(uuid,text,timestamptz,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reactivate_subscription(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription(uuid,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.renew_subscription(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_subscription(uuid,jsonb) TO authenticated, service_role;