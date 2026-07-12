
-- ─────────────────────────────────────────────────────────────────────
-- Module 54.2 Phase 5 — Writer lock on public.billing_subscriptions
-- ─────────────────────────────────────────────────────────────────────
-- Blocks any direct INSERT that does NOT populate the three canonical
-- source columns, except when invoked by trusted system roles or by a
-- canonical SECURITY DEFINER function that has set the bypass GUC.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_forbid_direct_billing_subscription_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text;
  v_role   text := session_user::text;
BEGIN
  -- Canonical bypass: SECURITY DEFINER canonical functions
  -- (e.g. create_subscriptions_from_order, provision_services_for_order)
  -- can set this GUC locally before their INSERTs.
  BEGIN
    v_bypass := current_setting('app.canonical_subscription_writer', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Trusted DB-level roles (service_role / postgres / supabase_admin)
  -- are allowed to insert even if source columns are missing, so that
  -- existing canonical Edge Functions running as service_role continue
  -- to operate during the ongoing canonicalization.
  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- All other callers (authenticated, anon, etc.) MUST populate the
  -- three canonical source columns.
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

REVOKE ALL ON FUNCTION public.fn_forbid_direct_billing_subscription_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_forbid_direct_billing_subscription_insert
  ON public.billing_subscriptions;

CREATE TRIGGER trg_forbid_direct_billing_subscription_insert
BEFORE INSERT ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.fn_forbid_direct_billing_subscription_insert();

COMMENT ON TRIGGER trg_forbid_direct_billing_subscription_insert
  ON public.billing_subscriptions IS
  'Module 54.2 Phase 5 — Blocks direct non-canonical inserts. Requires source_type, source_id, source_order_item_id unless caller is a trusted role or a canonical SECURITY DEFINER function (bypass GUC app.canonical_subscription_writer=on).';
