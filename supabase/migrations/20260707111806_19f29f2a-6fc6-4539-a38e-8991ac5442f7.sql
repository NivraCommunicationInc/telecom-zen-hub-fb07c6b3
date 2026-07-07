-- Drop legacy wrappers avant recréation (signatures incompatibles).
DROP FUNCTION IF EXISTS public.fn_run_subscription_renewals(integer);
DROP FUNCTION IF EXISTS public.fn_generate_subscription_renewal(uuid);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3.C.1 — Fondation DB abonnements gelés (Square-only)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_plan_id text;

CREATE OR REPLACE FUNCTION public.fn_sync_provider_ids_bs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.provider_subscription_id IS NULL AND NEW.paypal_subscription_id IS NOT NULL THEN
    NEW.provider_subscription_id := NEW.paypal_subscription_id;
  END IF;
  IF NEW.provider_plan_id IS NULL AND NEW.paypal_plan_id IS NOT NULL THEN
    NEW.provider_plan_id := NEW.paypal_plan_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_provider_ids_bs ON public.billing_subscriptions;
CREATE TRIGGER trg_sync_provider_ids_bs
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_provider_ids_bs();

UPDATE public.billing_subscriptions
   SET provider_subscription_id = COALESCE(provider_subscription_id, paypal_subscription_id),
       provider_plan_id         = COALESCE(provider_plan_id, paypal_plan_id)
 WHERE provider_subscription_id IS NULL OR provider_plan_id IS NULL;

UPDATE public.billing_subscriptions
   SET recurring_provider = 'square'
 WHERE (recurring_provider IS NULL OR recurring_provider = 'internal')
   AND status IN ('active','pending');

CREATE OR REPLACE FUNCTION public.fn_assert_subscription_provider_square()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.status IN ('active','pending')
     AND NEW.recurring_provider IS NOT NULL
     AND NEW.recurring_provider NOT IN ('square','internal') THEN
    RAISE EXCEPTION '[3C1] Nouvel abonnement actif doit utiliser Square (reçu: %)', NEW.recurring_provider
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assert_sub_provider_square ON public.billing_subscriptions;
CREATE TRIGGER trg_assert_sub_provider_square
  BEFORE INSERT ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_assert_subscription_provider_square();

CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_invoices_renewal_cycle
  ON public.billing_invoices (subscription_id, cycle_start_date, cycle_end_date)
  WHERE type = 'renewal' AND status NOT IN ('void','cancelled');

CREATE OR REPLACE FUNCTION public.renew_subscription(
  p_subscription_id uuid, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_sub public.billing_subscriptions%ROWTYPE;
  v_invoice_id uuid; v_existing uuid;
  v_next_start date; v_next_end date;
  v_subtotal numeric(10,2);
  v_gst_rate numeric(6,4) := 0.0500;
  v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2);
  v_invoice_number text;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id USING ERRCODE='no_data_found'; END IF;
  IF v_sub.frozen_unit_price IS NULL OR v_sub.frozen_name IS NULL THEN
    RAISE EXCEPTION 'Abonnement % sans données figées (frozen_*)', p_subscription_id USING ERRCODE='check_violation';
  END IF;
  IF v_sub.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'Abonnement % non-renouvelable (statut=%)', p_subscription_id, v_sub.status USING ERRCODE='check_violation';
  END IF;

  v_next_start := COALESCE(v_sub.cycle_end_date, CURRENT_DATE);
  v_next_end   := v_next_start + INTERVAL '1 month';

  SELECT id INTO v_existing FROM public.billing_invoices
   WHERE subscription_id=v_sub.id AND type='renewal'
     AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
     AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_subtotal := v_sub.frozen_unit_price;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);
  v_invoice_number := 'INV-RNW-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);

  BEGIN
    INSERT INTO public.billing_invoices (
      customer_id, invoice_number, status, subscription_id, type,
      subtotal, tps_amount, tvq_amount, total,
      tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid,
      cycle_start_date, cycle_end_date, due_date, currency, payment_method
    ) VALUES (
      v_sub.customer_id, v_invoice_number, 'pending', v_sub.id, 'renewal',
      v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
      jsonb_build_object(
        'gst_rate', v_gst_rate, 'qst_rate', v_qst_rate,
        'gst_amount', v_gst, 'qst_amount', v_qst,
        'jurisdiction','QC','computed_at', now(),
        'source','renewal_frozen',
        'frozen_unit_price', v_sub.frozen_unit_price,
        'source_subscription_id', v_sub.id
      ),
      0, v_next_start, v_next_end, v_next_end, COALESCE(v_sub.frozen_currency,'CAD'), 'manual'
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_invoice_id FROM public.billing_invoices
     WHERE subscription_id=v_sub.id AND type='renewal'
       AND cycle_start_date=v_next_start AND cycle_end_date=v_next_end
       AND status NOT IN ('void','cancelled') LIMIT 1;
    RETURN v_invoice_id;
  END;

  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, source_order_item_id, metadata
  ) VALUES (
    v_invoice_id, v_sub.frozen_name || ' — Renouvellement',
    v_sub.frozen_unit_price, 1, v_sub.frozen_unit_price,
    'service', 'subscription_renewal', 'product_recurring', v_sub.source_order_item_id,
    jsonb_build_object(
      'source_subscription_id', v_sub.id, 'renewal', true,
      'frozen_unit_price', v_sub.frozen_unit_price,
      'frozen_name', v_sub.frozen_name, 'frozen_code', v_sub.frozen_code
    )
  );

  UPDATE public.billing_subscriptions
     SET last_invoice_id=v_invoice_id,
         cycle_start_date=v_next_start,
         cycle_end_date=v_next_end
   WHERE id=v_sub.id;

  PERFORM public._nivra_record_provenance(
    'billing_invoice', v_invoice_id, 'renewal_created','renew_subscription', p_context,
    'billing_subscription', v_sub.id,
    jsonb_build_object('frozen_price', v_sub.frozen_unit_price, 'total', v_total,
                       'cycle_start', v_next_start, 'cycle_end', v_next_end));
  RETURN v_invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_forbid_live_catalog_read_on_renewal()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_inv public.billing_invoices%ROWTYPE;
  v_sub_id uuid; v_sub public.billing_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.billing_invoices WHERE id=NEW.invoice_id;
  IF v_inv.type IS DISTINCT FROM 'renewal' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.line_kind,'') <> 'product_recurring' THEN RETURN NEW; END IF;

  v_sub_id := NULLIF(NEW.metadata->>'source_subscription_id','')::uuid;
  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION '[3C1-anti-drift] Ligne renewal sans metadata.source_subscription_id (invoice=%)', NEW.invoice_id
      USING ERRCODE='check_violation';
  END IF;
  IF v_sub_id <> v_inv.subscription_id THEN
    RAISE EXCEPTION '[3C1-anti-drift] source_subscription_id (%) != invoice.subscription_id (%)',
      v_sub_id, v_inv.subscription_id USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=v_sub_id;
  IF NOT FOUND OR v_sub.frozen_unit_price IS NULL THEN
    RAISE EXCEPTION '[3C1-anti-drift] Subscription source % introuvable ou sans frozen_*', v_sub_id
      USING ERRCODE='check_violation';
  END IF;

  IF ROUND(NEW.unit_price,2) <> ROUND(v_sub.frozen_unit_price,2) THEN
    RAISE EXCEPTION '[3C1-anti-drift] unit_price (%) != frozen_unit_price (%) — lecture catalogue interdite',
      NEW.unit_price, v_sub.frozen_unit_price USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forbid_live_catalog_read_on_renewal ON public.billing_invoice_lines;
CREATE TRIGGER trg_forbid_live_catalog_read_on_renewal
  BEFORE INSERT OR UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_live_catalog_read_on_renewal();

CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_subscription_id uuid, p_reason text DEFAULT NULL, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sub public.billing_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id; END IF;
  IF v_sub.status='cancelled' THEN RETURN v_sub.id; END IF;
  UPDATE public.billing_subscriptions SET status='cancelled', updated_at=now() WHERE id=p_subscription_id;
  PERFORM public._nivra_record_provenance('billing_subscription', p_subscription_id,
    'subscription_cancelled','cancel_subscription', p_context,
    'billing_subscription', p_subscription_id,
    jsonb_build_object('reason', p_reason, 'previous_status', v_sub.status));
  RETURN p_subscription_id;
END $$;

CREATE OR REPLACE FUNCTION public.suspend_subscription(
  p_subscription_id uuid, p_reason text DEFAULT NULL,
  p_pause_until timestamptz DEFAULT NULL, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sub public.billing_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id; END IF;
  IF v_sub.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'Abonnement % non-suspensable (statut=%)', p_subscription_id, v_sub.status;
  END IF;
  UPDATE public.billing_subscriptions
     SET status='suspended', paused_at=now(), pause_until=p_pause_until,
         pause_reason=p_reason, updated_at=now()
   WHERE id=p_subscription_id;
  PERFORM public._nivra_record_provenance('billing_subscription', p_subscription_id,
    'subscription_suspended','suspend_subscription', p_context,
    'billing_subscription', p_subscription_id,
    jsonb_build_object('reason', p_reason, 'pause_until', p_pause_until));
  RETURN p_subscription_id;
END $$;

CREATE OR REPLACE FUNCTION public.reactivate_subscription(
  p_subscription_id uuid, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sub public.billing_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id; END IF;
  IF v_sub.status <> 'suspended' THEN
    RAISE EXCEPTION 'Abonnement % non-réactivable (statut=%)', p_subscription_id, v_sub.status;
  END IF;
  UPDATE public.billing_subscriptions
     SET status='active', paused_at=NULL, pause_until=NULL, pause_reason=NULL, updated_at=now()
   WHERE id=p_subscription_id;
  PERFORM public._nivra_record_provenance('billing_subscription', p_subscription_id,
    'subscription_reactivated','reactivate_subscription', p_context,
    'billing_subscription', p_subscription_id, '{}'::jsonb);
  RETURN p_subscription_id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_plan_change(
  p_old_subscription_id uuid,
  p_new_plan_code text, p_new_plan_name text, p_new_plan_price numeric,
  p_new_frozen_code text DEFAULT NULL, p_new_frozen_name text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.billing_subscriptions%ROWTYPE; v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.billing_subscriptions WHERE id=p_old_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement source % introuvable', p_old_subscription_id; END IF;
  IF v_old.status NOT IN ('active','pending','suspended') THEN
    RAISE EXCEPTION 'Abonnement % non-modifiable (statut=%)', p_old_subscription_id, v_old.status;
  END IF;
  IF v_old.superseded_by_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Abonnement % déjà remplacé par %', p_old_subscription_id, v_old.superseded_by_subscription_id;
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price,
    frozen_code, frozen_name, frozen_unit_price, frozen_currency,
    frozen_cycle, frozen_frequency, frozen_anchor_date,
    cycle_start_date, cycle_end_date,
    status, service_category, address_id, service_address_id,
    order_id, source_type, source_id, environment,
    recurring_provider, supersedes_subscription_id, auto_billing_enabled
  ) VALUES (
    v_old.customer_id, p_new_plan_code, p_new_plan_name, p_new_plan_price,
    COALESCE(p_new_frozen_code, p_new_plan_code),
    COALESCE(p_new_frozen_name, p_new_plan_name),
    p_new_plan_price, COALESCE(v_old.frozen_currency,'CAD'),
    v_old.frozen_cycle, v_old.frozen_frequency, CURRENT_DATE,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month',
    'active', v_old.service_category, v_old.address_id, v_old.service_address_id,
    v_old.order_id, 'plan_change', p_old_subscription_id::text, v_old.environment,
    'square', p_old_subscription_id, COALESCE(v_old.auto_billing_enabled, true)
  ) RETURNING id INTO v_new_id;

  UPDATE public.billing_subscriptions
     SET status='cancelled', superseded_by_subscription_id=v_new_id, updated_at=now()
   WHERE id=p_old_subscription_id;

  PERFORM public._nivra_record_provenance(
    'billing_subscription', v_new_id, 'plan_change_applied','apply_plan_change', p_context,
    'billing_subscription', p_old_subscription_id,
    jsonb_build_object('old_plan_code', v_old.plan_code, 'old_frozen_price', v_old.frozen_unit_price,
                       'new_plan_code', p_new_plan_code, 'new_price', p_new_plan_price));
  PERFORM public._nivra_record_provenance(
    'billing_subscription', p_old_subscription_id, 'plan_change_superseded','apply_plan_change', p_context,
    'billing_subscription', v_new_id, jsonb_build_object('superseded_by', v_new_id));
  RETURN v_new_id;
END $$;

CREATE OR REPLACE FUNCTION public.run_subscription_renewals(
  p_lookahead_days integer DEFAULT 3, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(subscription_id uuid, invoice_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; v_invoice_id uuid;
BEGIN
  FOR r IN
    SELECT id FROM public.billing_subscriptions
     WHERE status IN ('active','pending')
       AND frozen_unit_price IS NOT NULL AND frozen_name IS NOT NULL
       AND cycle_end_date IS NOT NULL
       AND cycle_end_date <= CURRENT_DATE + (p_lookahead_days || ' days')::interval
       AND superseded_by_subscription_id IS NULL
  LOOP
    BEGIN
      v_invoice_id := public.renew_subscription(r.id, p_context || jsonb_build_object('trigger','cron'));
      subscription_id := r.id; invoice_id := v_invoice_id; status := 'ok'; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      subscription_id := r.id; invoice_id := NULL; status := 'error: ' || SQLERRM; RETURN NEXT;
    END;
  END LOOP;
  RETURN;
END $$;

-- Deprecated wrappers (retour jsonb, avertissement runtime).
CREATE OR REPLACE FUNCTION public.fn_generate_subscription_renewal(p_subscription_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  RAISE WARNING '[DEPRECATED-3C1] fn_generate_subscription_renewal — utilisez renew_subscription()';
  v_id := public.renew_subscription(p_subscription_id, jsonb_build_object('legacy_caller','fn_generate_subscription_renewal'));
  RETURN jsonb_build_object('success', true, 'invoice_id', v_id, 'deprecated', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_run_subscription_renewals(p_lookahead_days integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;
BEGIN
  RAISE WARNING '[DEPRECATED-3C1] fn_run_subscription_renewals — utilisez run_subscription_renewals()';
  SELECT count(*) INTO v_count FROM public.run_subscription_renewals(p_lookahead_days,
    jsonb_build_object('legacy_caller','fn_run_subscription_renewals'));
  RETURN jsonb_build_object('success', true, 'processed', v_count, 'deprecated', true);
END $$;

CREATE OR REPLACE VIEW public.v_subscription_renewal_health
WITH (security_invoker = on) AS
SELECT
  s.id AS subscription_id, s.customer_id, s.status, s.recurring_provider,
  s.cycle_start_date, s.cycle_end_date,
  s.frozen_unit_price, s.frozen_name,
  (s.frozen_unit_price IS NOT NULL AND s.frozen_name IS NOT NULL) AS frozen_ok,
  s.superseded_by_subscription_id, s.supersedes_subscription_id,
  (SELECT COUNT(*) FROM public.billing_invoices bi
    WHERE bi.subscription_id = s.id AND bi.type='renewal'
      AND bi.status NOT IN ('void','cancelled')) AS renewal_invoice_count
FROM public.billing_subscriptions s;

GRANT SELECT ON public.v_subscription_renewal_health TO authenticated, service_role;