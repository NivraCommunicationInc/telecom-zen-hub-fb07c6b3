
-- ============================================================
-- MODULE 54.2 — PHASE 6 : Verrou canonique durci billing_subscriptions
-- ============================================================

-- 1) Allow-list table
CREATE TABLE IF NOT EXISTS public.billing_subscription_writer_allowlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL UNIQUE,
  allowed_operations text[] NOT NULL DEFAULT ARRAY['INSERT','UPDATE','DELETE'],
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_subscription_writer_allowlist TO authenticated;
GRANT ALL   ON public.billing_subscription_writer_allowlist TO service_role;

ALTER TABLE public.billing_subscription_writer_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read writer allowlist" ON public.billing_subscription_writer_allowlist;
CREATE POLICY "Staff can read writer allowlist"
  ON public.billing_subscription_writer_allowlist
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'billing_admin')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
    OR public.has_role(auth.uid(),'ops')
  );

-- 2) Seed canonical writers
INSERT INTO public.billing_subscription_writer_allowlist (function_name, allowed_operations, category, notes) VALUES
  ('create_subscriptions_from_order',       ARRAY['INSERT','UPDATE'], 'provisioning', 'Canonical creation from paid order'),
  ('provision_services_for_order',          ARRAY['INSERT','UPDATE'], 'provisioning', 'Bulk provisioning gateway'),
  ('create_subscription_ad_hoc',            ARRAY['INSERT','UPDATE'], 'provisioning', 'Manual subscription creation'),
  ('cancel_subscription',                   ARRAY['UPDATE'],          'state_machine','Cancellation'),
  ('suspend_subscription',                  ARRAY['UPDATE'],          'state_machine','Suspension / pause'),
  ('reactivate_subscription',               ARRAY['UPDATE'],          'state_machine','Reactivation / resume'),
  ('renew_subscription',                    ARRAY['UPDATE'],          'state_machine','Renewal cycle'),
  ('apply_plan_change',                     ARRAY['UPDATE'],          'state_machine','Plan change'),
  ('close_and_supersede_subscription',      ARRAY['UPDATE'],          'state_machine','Supersede on plan change'),
  ('fn_activate_sub_on_order_activation',   ARRAY['UPDATE'],          'automation',   'Order to sub activation'),
  ('fn_cancel_sub_on_order_cancel',         ARRAY['UPDATE'],          'automation',   'Order to sub cancel'),
  ('cancel_subscription_on_order_cancel',   ARRAY['UPDATE'],          'automation',   'Legacy alias'),
  ('update_subscription_on_invoice_paid',   ARRAY['UPDATE'],          'automation',   'Invoice paid sync'),
  ('billing_invoice_paid_trigger',          ARRAY['UPDATE'],          'automation',   'Invoice paid trigger'),
  ('billing_invoice_failed_trigger',        ARRAY['UPDATE'],          'automation',   'Invoice failed trigger'),
  ('enforce_subscription_setup_status',     ARRAY['UPDATE'],          'automation',   'Setup status guard'),
  ('fn_sync_last_invoice_id',               ARRAY['UPDATE'],          'automation',   'Last invoice sync'),
  ('trg_sync_last_invoice_id',              ARRAY['UPDATE'],          'automation',   'Last invoice trigger'),
  ('fn_backfill_paid_invoice_subscription_link', ARRAY['UPDATE'],     'automation',   'Backfill link'),
  ('fn_create_reactivation_fee_on_payment', ARRAY['UPDATE'],          'automation',   'Reactivation fee'),
  ('client_resume_paused_service',          ARRAY['UPDATE'],          'automation',   'Client-initiated resume'),
  ('auto_resume_paused_services',           ARRAY['UPDATE'],          'automation',   'Scheduled auto-resume'),
  ('generate_account_renewal_invoice',      ARRAY['UPDATE'],          'automation',   'Account renewal invoice'),
  ('repair_order_client_portal_links',      ARRAY['UPDATE'],          'automation',   'Portal repair'),
  ('fn_attach_subscription_to_paid_invoice',ARRAY['UPDATE'],          'automation',   'Attach sub to paid invoice (canonical)'),
  ('fn_ensure_subscription_on_invoice_paid',ARRAY['INSERT','UPDATE'], 'automation',   'Repair missing sub on paid invoice'),
  ('fn_repair_activated_order_canonical_chain', ARRAY['INSERT','UPDATE'], 'recovery', 'Chain recovery for activated orders'),
  ('reconcile_orphan_paid_orders',          ARRAY['INSERT','UPDATE'], 'recovery',     'Reconcile orphan paid orders'),
  ('build_invoice_ad_hoc',                  ARRAY['UPDATE'],          'automation',   'Ad-hoc invoice cascade')
ON CONFLICT (function_name) DO UPDATE
  SET allowed_operations = EXCLUDED.allowed_operations,
      category = EXCLUDED.category,
      notes = EXCLUDED.notes,
      updated_at = now();

-- 3) touch trigger
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at_bs_allowlist()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bs_allowlist_touch ON public.billing_subscription_writer_allowlist;
CREATE TRIGGER trg_bs_allowlist_touch
  BEFORE UPDATE ON public.billing_subscription_writer_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at_bs_allowlist();

-- 4) Hardened writer-lock function
CREATE OR REPLACE FUNCTION public.fn_enforce_billing_subscription_writer_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stack text := '';
  v_allowed record;
  v_matched boolean := false;
BEGIN
  GET DIAGNOSTICS v_stack = PG_CONTEXT;

  FOR v_allowed IN
    SELECT function_name, allowed_operations
      FROM public.billing_subscription_writer_allowlist
     WHERE active = true
  LOOP
    IF v_stack ~ ('\m' || v_allowed.function_name || '\M')
       AND TG_OP = ANY (v_allowed.allowed_operations)
    THEN
      v_matched := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_matched THEN
    RAISE EXCEPTION 'DIRECT_BILLING_SUBSCRIPTION_%_FORBIDDEN: writes must go through an allow-listed canonical function. Stack: %', TG_OP, LEFT(v_stack, 400)
      USING ERRCODE = '42501',
            HINT = 'Use a canonical RPC (see billing_subscription_writer_allowlist).';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source_type IS NULL OR NEW.source_id IS NULL THEN
      RAISE EXCEPTION 'CANONICAL_SUBSCRIPTION_METADATA_REQUIRED: source_type and source_id are required'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END; $$;

-- 5) Canonical RPCs

CREATE OR REPLACE FUNCTION public.rpc_admin_change_subscription_plan(
  p_subscription_id uuid,
  p_new_plan_name   text,
  p_new_plan_price  numeric,
  p_new_plan_code   text DEFAULT NULL,
  p_reason          text DEFAULT NULL,
  p_context         jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sub record; v_caller uuid; v_old_price numeric; v_old_name text; v_old_code text;
BEGIN
  v_caller := auth.uid();
  IF NOT (
    public.has_role(v_caller,'admin')
    OR public.has_role(v_caller,'billing_admin')
    OR public.has_role(v_caller,'supervisor')
    OR public.has_role(v_caller,'support')
    OR public.has_role(v_caller,'ops')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND: %', p_subscription_id; END IF;

  v_old_name  := v_sub.plan_name;
  v_old_price := v_sub.plan_price;
  v_old_code  := v_sub.plan_code;

  UPDATE public.billing_subscriptions
     SET plan_name  = COALESCE(p_new_plan_name, plan_name),
         plan_price = COALESCE(p_new_plan_price, plan_price),
         plan_code  = COALESCE(p_new_plan_code, plan_code),
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.billing_subscription_trace_audit
    (subscription_id, customer_id, action, reason, details)
  VALUES
    (p_subscription_id, v_sub.customer_id, 'plan_changed', p_reason,
     jsonb_build_object(
       'old_plan', v_old_name, 'old_price', v_old_price, 'old_code', v_old_code,
       'new_plan', p_new_plan_name, 'new_price', p_new_plan_price, 'new_code', p_new_plan_code,
       'actor_id', v_caller,
       'context',  p_context
     ));

  RETURN jsonb_build_object('ok', true, 'subscription_id', p_subscription_id);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_transfer_subscription_ownership(
  p_old_client_id uuid,
  p_new_client_id uuid,
  p_reason        text DEFAULT NULL,
  p_context       jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_caller uuid; v_updated int;
BEGIN
  v_caller := auth.uid();
  -- called by EF via service_role; allow when caller is null (service context)
  -- OR when caller has admin/ops role
  IF v_caller IS NOT NULL AND NOT (
    public.has_role(v_caller,'admin')
    OR public.has_role(v_caller,'ops')
    OR public.has_role(v_caller,'supervisor')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: admin/ops required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.billing_subscriptions
     SET client_id = p_new_client_id, updated_at = now()
   WHERE client_id = p_old_client_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.billing_subscription_trace_audit
    (subscription_id, customer_id, action, reason, details)
  SELECT id, customer_id, 'ownership_transferred', p_reason,
         jsonb_build_object('old_client_id', p_old_client_id,
                            'new_client_id', p_new_client_id,
                            'actor_id', v_caller,
                            'context', p_context)
    FROM public.billing_subscriptions
   WHERE client_id = p_new_client_id;

  RETURN jsonb_build_object('ok', true, 'rows_updated', v_updated);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_set_subscription_last_invoice(
  p_subscription_id uuid,
  p_invoice_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.billing_subscriptions
     SET last_invoice_id = p_invoice_id, updated_at = now()
   WHERE id = p_subscription_id;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_upsert_field_sales_subscription(
  p_order_id uuid,
  p_payload  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existing uuid; v_new uuid;
BEGIN
  SELECT id INTO v_existing FROM public.billing_subscriptions WHERE order_id = p_order_id LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.billing_subscriptions
       SET plan_code            = COALESCE(p_payload->>'plan_code', plan_code),
           plan_name            = COALESCE(p_payload->>'plan_name', plan_name),
           plan_price           = COALESCE((p_payload->>'plan_price')::numeric, plan_price),
           status               = COALESCE(p_payload->>'status', status),
           cycle_start_date     = COALESCE(NULLIF(p_payload->>'cycle_start_date','')::date, cycle_start_date),
           cycle_end_date       = COALESCE(NULLIF(p_payload->>'cycle_end_date','')::date, cycle_end_date),
           billing_cycle_anchor = COALESCE(NULLIF(p_payload->>'billing_cycle_anchor','')::timestamptz, billing_cycle_anchor),
           next_renewal_at      = COALESCE(NULLIF(p_payload->>'next_renewal_at','')::timestamptz, next_renewal_at),
           auto_billing_enabled = COALESCE((p_payload->>'auto_billing_enabled')::boolean, auto_billing_enabled),
           updated_at           = now()
     WHERE id = v_existing;
    RETURN jsonb_build_object('ok', true, 'action','updated','subscription_id', v_existing);
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, order_id, source_order_item_id, service_address_id,
    plan_code, plan_name, plan_price, status,
    cycle_start_date, cycle_end_date, billing_cycle_anchor, next_renewal_at,
    auto_billing_enabled, environment, source_type, source_id
  ) VALUES (
    (p_payload->>'customer_id')::uuid,
    p_order_id,
    NULLIF(p_payload->>'source_order_item_id','')::uuid,
    NULLIF(p_payload->>'service_address_id','')::uuid,
    COALESCE(p_payload->>'plan_code','service'),
    COALESCE(p_payload->>'plan_name','Service'),
    COALESCE((p_payload->>'plan_price')::numeric, 0),
    COALESCE(p_payload->>'status','pending'),
    NULLIF(p_payload->>'cycle_start_date','')::date,
    NULLIF(p_payload->>'cycle_end_date','')::date,
    NULLIF(p_payload->>'billing_cycle_anchor','')::timestamptz,
    NULLIF(p_payload->>'next_renewal_at','')::timestamptz,
    COALESCE((p_payload->>'auto_billing_enabled')::boolean, false),
    COALESCE(p_payload->>'environment','live'),
    'field_sales',
    p_order_id::text
  ) RETURNING id INTO v_new;

  RETURN jsonb_build_object('ok', true, 'action','inserted','subscription_id', v_new);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_pause_subscription(
  p_subscription_id uuid,
  p_action          text,
  p_pause_until     timestamptz DEFAULT NULL,
  p_reason          text DEFAULT NULL,
  p_context         jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_caller uuid; v_sub record;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND NOT (
    public.has_role(v_caller,'admin')
    OR public.has_role(v_caller,'billing_admin')
    OR public.has_role(v_caller,'supervisor')
    OR public.has_role(v_caller,'support')
    OR public.has_role(v_caller,'ops')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  IF p_action = 'pause' THEN
    UPDATE public.billing_subscriptions
       SET status = 'suspended',
           paused_at = now(),
           pause_until = p_pause_until,
           pause_reason = p_reason,
           updated_at = now()
     WHERE id = p_subscription_id;
  ELSIF p_action = 'resume' THEN
    UPDATE public.billing_subscriptions
       SET status = 'active',
           paused_at = NULL,
           pause_until = NULL,
           pause_reason = NULL,
           updated_at = now()
     WHERE id = p_subscription_id;
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION: pause|resume expected';
  END IF;

  INSERT INTO public.billing_subscription_trace_audit
    (subscription_id, customer_id, action, reason, details)
  VALUES
    (p_subscription_id, v_sub.customer_id,
     CASE WHEN p_action='pause' THEN 'service_suspended' ELSE 'service_resumed' END,
     p_reason,
     jsonb_build_object('actor_id', v_caller, 'pause_until', p_pause_until, 'context', p_context));

  RETURN jsonb_build_object('ok', true, 'subscription_id', p_subscription_id);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_qa_reset_subscription_fixture(
  p_customer_ids uuid[] DEFAULT NULL,
  p_order_ids    uuid[] DEFAULT NULL,
  p_subscription_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.billing_subscriptions
   WHERE environment = 'test'
     AND (
       (p_customer_ids     IS NOT NULL AND customer_id = ANY(p_customer_ids))
       OR (p_order_ids     IS NOT NULL AND order_id    = ANY(p_order_ids))
       OR (p_subscription_ids IS NOT NULL AND id       = ANY(p_subscription_ids))
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END; $$;

-- 6) Grants on RPCs
GRANT EXECUTE ON FUNCTION public.rpc_admin_change_subscription_plan(uuid,text,numeric,text,text,jsonb)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_transfer_subscription_ownership(uuid,uuid,text,jsonb)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_subscription_last_invoice(uuid,uuid)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_upsert_field_sales_subscription(uuid,jsonb)                           TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_pause_subscription(uuid,text,timestamptz,text,jsonb)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_qa_reset_subscription_fixture(uuid[],uuid[],uuid[])                         TO service_role;

-- 7) Register new RPCs
INSERT INTO public.billing_subscription_writer_allowlist (function_name, allowed_operations, category, notes) VALUES
  ('rpc_admin_change_subscription_plan',            ARRAY['UPDATE'],          'admin_gateway','Admin plan change UI'),
  ('rpc_admin_transfer_subscription_ownership',     ARRAY['UPDATE'],          'admin_gateway','Ownership transfer (Module 48)'),
  ('rpc_admin_set_subscription_last_invoice',       ARRAY['UPDATE'],          'automation',   'Set last_invoice_id post creation'),
  ('rpc_admin_upsert_field_sales_subscription',     ARRAY['INSERT','UPDATE'], 'admin_gateway','Field-sales upsert'),
  ('rpc_admin_pause_subscription',                  ARRAY['UPDATE'],          'admin_gateway','Admin pause/resume UI'),
  ('rpc_qa_reset_subscription_fixture',             ARRAY['DELETE'],          'qa',           'QA fixture reset (env=test only)')
ON CONFLICT (function_name) DO UPDATE
  SET allowed_operations = EXCLUDED.allowed_operations,
      category = EXCLUDED.category,
      notes = EXCLUDED.notes,
      active = true,
      updated_at = now();
