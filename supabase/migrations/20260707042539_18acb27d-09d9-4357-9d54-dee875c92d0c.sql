
-- =====================================================================
-- PHASE 2 — RPC CANONIQUES + INFRASTRUCTURE (simplifié)
-- Les RPC restent SECURITY DEFINER. Le verrouillage définitif du modèle
-- de rôle est repoussé en Phase 4 après migration des Edge Functions.
-- =====================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nivra_billing_writer') THEN
    CREATE ROLE nivra_billing_writer NOLOGIN;
  END IF;
END
$do$;

-- billing_provenance ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_provenance (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type           text NOT NULL,
  object_id             uuid NOT NULL,
  event                 text NOT NULL,
  rpc_name              text NOT NULL,
  edge_function_name    text,
  module                text,
  actor_user_id         uuid,
  actor_role            text,
  reason                text,
  parent_object_type    text,
  parent_object_id      uuid,
  request_id            text,
  ip_address            text,
  user_agent            text,
  payload_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_provenance_object ON public.billing_provenance (object_type, object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_provenance_actor  ON public.billing_provenance (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_provenance_rpc    ON public.billing_provenance (rpc_name, created_at DESC);

GRANT SELECT ON public.billing_provenance TO authenticated;
GRANT ALL    ON public.billing_provenance TO service_role;

ALTER TABLE public.billing_provenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_provenance" ON public.billing_provenance;
CREATE POLICY "staff_read_provenance" ON public.billing_provenance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'employee'::app_role)
      OR public.has_role(auth.uid(), 'billing_admin'::app_role));

CREATE OR REPLACE FUNCTION public.fn_billing_provenance_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'billing_provenance est un registre immuable.' USING ERRCODE = 'insufficient_privilege'; END; $$;

DROP TRIGGER IF EXISTS trg_billing_provenance_no_update ON public.billing_provenance;
CREATE TRIGGER trg_billing_provenance_no_update BEFORE UPDATE OR DELETE ON public.billing_provenance
  FOR EACH ROW EXECUTE FUNCTION public.fn_billing_provenance_immutable();

-- Colonnes fiscales figées sur billing_invoices ------------------------
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS tax_gst_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS tax_qst_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS tax_snapshot jsonb;
COMMENT ON COLUMN public.billing_invoices.tax_snapshot IS 'Instantané figé des taxes. Immuable une fois la facture émise.';

-- Neutralisation du recalcul auto quand snapshot présent ---------------
CREATE OR REPLACE FUNCTION public.fn_invoice_math_from_subtotal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_subtotal numeric;
BEGIN
  IF NEW.tax_snapshot IS NOT NULL THEN RETURN NEW; END IF;
  v_subtotal := ROUND(COALESCE(NEW.subtotal, 0)::numeric, 2);
  NEW.subtotal := v_subtotal;
  NEW.tps_amount := ROUND(v_subtotal * 0.05, 2);
  NEW.tvq_amount := ROUND(v_subtotal * 0.09975, 2);
  NEW.total := ROUND(v_subtotal + NEW.tps_amount + NEW.tvq_amount, 2);
  RETURN NEW;
END; $$;

-- Gel des colonnes financières après émission -------------------------
CREATE OR REPLACE FUNCTION public.fn_invoice_freeze_financials()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT NULL AND OLD.status::text <> 'draft' AND OLD.tax_snapshot IS NOT NULL THEN
    IF NEW.subtotal     IS DISTINCT FROM OLD.subtotal     THEN RAISE EXCEPTION 'subtotal immuable après émission.' USING ERRCODE='check_violation'; END IF;
    IF NEW.tps_amount   IS DISTINCT FROM OLD.tps_amount   THEN RAISE EXCEPTION 'tps_amount immuable.' USING ERRCODE='check_violation'; END IF;
    IF NEW.tvq_amount   IS DISTINCT FROM OLD.tvq_amount   THEN RAISE EXCEPTION 'tvq_amount immuable.' USING ERRCODE='check_violation'; END IF;
    IF NEW.total        IS DISTINCT FROM OLD.total        THEN RAISE EXCEPTION 'total immuable.' USING ERRCODE='check_violation'; END IF;
    IF NEW.tax_gst_rate IS DISTINCT FROM OLD.tax_gst_rate THEN RAISE EXCEPTION 'tax_gst_rate immuable.' USING ERRCODE='check_violation'; END IF;
    IF NEW.tax_qst_rate IS DISTINCT FROM OLD.tax_qst_rate THEN RAISE EXCEPTION 'tax_qst_rate immuable.' USING ERRCODE='check_violation'; END IF;
    IF NEW.tax_snapshot IS DISTINCT FROM OLD.tax_snapshot THEN RAISE EXCEPTION 'tax_snapshot immuable.' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_invoice_freeze_financials ON public.billing_invoices;
CREATE TRIGGER trg_invoice_freeze_financials BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_freeze_financials();

-- Immutabilité des order_items après utilisation ------------------------
CREATE OR REPLACE FUNCTION public.fn_order_items_immutable_after_use()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_used boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.billing_invoice_lines WHERE source_order_item_id = OLD.id
    UNION ALL
    SELECT 1 FROM public.billing_subscriptions WHERE source_order_item_id = OLD.id
  ) INTO v_used;
  IF NOT v_used THEN RETURN NEW; END IF;
  IF NEW.unit_price   IS DISTINCT FROM OLD.unit_price   THEN RAISE EXCEPTION 'order_item %: unit_price immuable après utilisation.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.quantity     IS DISTINCT FROM OLD.quantity     THEN RAISE EXCEPTION 'order_item %: quantity immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.line_total   IS DISTINCT FROM OLD.line_total   THEN RAISE EXCEPTION 'order_item %: line_total immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.is_recurring IS DISTINCT FROM OLD.is_recurring THEN RAISE EXCEPTION 'order_item %: is_recurring immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.service_type IS DISTINCT FROM OLD.service_type THEN RAISE EXCEPTION 'order_item %: service_type immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.plan_code    IS DISTINCT FROM OLD.plan_code    THEN RAISE EXCEPTION 'order_item %: plan_code immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  IF NEW.plan_name    IS DISTINCT FROM OLD.plan_name    THEN RAISE EXCEPTION 'order_item %: plan_name immuable.', OLD.id USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_order_items_immutable_after_use ON public.order_items;
CREATE TRIGGER trg_order_items_immutable_after_use BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_order_items_immutable_after_use();

-- Helper de provenance --------------------------------------------------
CREATE OR REPLACE FUNCTION public._nivra_record_provenance(
  p_object_type text, p_object_id uuid, p_event text, p_rpc_name text, p_context jsonb,
  p_parent_object_type text DEFAULT NULL, p_parent_object_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.billing_provenance (
    object_type, object_id, event, rpc_name, edge_function_name, module,
    actor_user_id, actor_role, reason, parent_object_type, parent_object_id,
    request_id, ip_address, user_agent, payload_snapshot
  ) VALUES (
    p_object_type, p_object_id, p_event, p_rpc_name,
    NULLIF(p_context->>'edge_function_name',''), NULLIF(p_context->>'module',''),
    NULLIF(p_context->>'actor_user_id','')::uuid, NULLIF(p_context->>'actor_role',''),
    NULLIF(p_context->>'reason',''), p_parent_object_type, p_parent_object_id,
    NULLIF(p_context->>'request_id',''), NULLIF(p_context->>'ip_address',''),
    NULLIF(p_context->>'user_agent',''), COALESCE(p_payload,'{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public._nivra_record_provenance(text,uuid,text,text,jsonb,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._nivra_record_provenance(text,uuid,text,text,jsonb,text,uuid,jsonb) TO authenticated, service_role;

-- RPC : build_invoice_from_order ---------------------------------------
CREATE OR REPLACE FUNCTION public.build_invoice_from_order(p_order_id uuid, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order public.orders%ROWTYPE; v_customer_id uuid; v_invoice_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_gst_rate numeric(6,4) := 0.0500; v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2);
  v_item record; v_invoice_number text;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'p_order_id requis' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande % introuvable', p_order_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_customer_id FROM public.billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'billing_customer introuvable pour user %', v_order.user_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_invoice_id FROM public.billing_invoices WHERE order_id = p_order_id AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN RETURN v_invoice_id; END IF;

  SELECT COALESCE(SUM(line_total),0) INTO v_subtotal FROM public.order_items WHERE order_id = p_order_id;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);

  IF v_order.total_amount IS NOT NULL AND ABS(v_order.total_amount - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Incohérence order %: total_amount=% calcul=%', p_order_id, v_order.total_amount, v_total USING ERRCODE='check_violation';
  END IF;

  v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  INSERT INTO public.billing_invoices (
    customer_id, order_id, invoice_number, status,
    subtotal, tps_amount, tvq_amount, total,
    tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid
  ) VALUES (
    v_customer_id, p_order_id, v_invoice_number, 'pending',
    v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
    jsonb_build_object('gst_rate',v_gst_rate,'qst_rate',v_qst_rate,'gst_amount',v_gst,'qst_amount',v_qst,'jurisdiction','QC','computed_at',now()),
    0
  ) RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id ORDER BY item_number LOOP
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total,
      line_type, source_ref, line_kind, source_order_item_id
    ) VALUES (
      v_invoice_id,
      v_item.plan_name || COALESCE(' — '||v_item.description,''),
      v_item.unit_price, v_item.quantity, v_item.line_total,
      CASE WHEN v_item.is_recurring THEN 'service' WHEN v_item.service_type::text='equipment' THEN 'equipment' ELSE 'fee' END,
      'order_item',
      CASE
        WHEN v_item.is_recurring THEN 'product_recurring'
        WHEN v_item.service_type::text='equipment' THEN 'equipment'
        WHEN v_item.service_type::text ILIKE '%shipping%' THEN 'shipping'
        WHEN v_item.service_type::text ILIKE '%activation%' THEN 'activation_fee'
        WHEN v_item.service_type::text ILIKE '%install%' THEN 'installation_fee'
        WHEN v_item.service_type::text ILIKE '%travel%' THEN 'travel_fee'
        ELSE 'product_one_time' END,
      v_item.id
    );
  END LOOP;

  PERFORM public._nivra_record_provenance('billing_invoice', v_invoice_id, 'created', 'build_invoice_from_order', p_context,
    'order', p_order_id, jsonb_build_object('subtotal',v_subtotal,'total',v_total));
  RETURN v_invoice_id;
END; $$;
REVOKE ALL ON FUNCTION public.build_invoice_from_order(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_invoice_from_order(uuid,jsonb) TO authenticated, service_role;

-- RPC : create_subscriptions_from_order --------------------------------
CREATE OR REPLACE FUNCTION public.create_subscriptions_from_order(p_order_id uuid, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.orders%ROWTYPE; v_customer_id uuid; v_item record; v_sub_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande % introuvable', p_order_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_customer_id FROM public.billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'billing_customer introuvable' USING ERRCODE='no_data_found'; END IF;
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id AND is_recurring = true ORDER BY item_number LOOP
    SELECT id INTO v_sub_id FROM public.billing_subscriptions WHERE source_order_item_id = v_item.id LIMIT 1;
    IF v_sub_id IS NOT NULL THEN RETURN NEXT v_sub_id; CONTINUE; END IF;
    INSERT INTO public.billing_subscriptions (
      customer_id, plan_code, plan_name, plan_price, service_category, order_id, environment, status,
      source_order_item_id, frozen_name, frozen_code, frozen_unit_price,
      frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date, source_type, source_id
    ) VALUES (
      v_customer_id, COALESCE(v_item.plan_code, v_item.service_type::text),
      v_item.plan_name, v_item.unit_price, v_item.service_type::text, p_order_id, 'live', 'pending',
      v_item.id, v_item.plan_name, COALESCE(v_item.plan_code, v_item.service_type::text), v_item.unit_price,
      'CAD', 'monthly', 'monthly', CURRENT_DATE, 'order_item', v_item.id::text
    ) RETURNING id INTO v_sub_id;
    PERFORM public._nivra_record_provenance('billing_subscription', v_sub_id, 'created', 'create_subscriptions_from_order', p_context,
      'order_item', v_item.id, jsonb_build_object('plan_name',v_item.plan_name,'unit_price',v_item.unit_price));
    RETURN NEXT v_sub_id;
  END LOOP;
  RETURN;
END; $$;
REVOKE ALL ON FUNCTION public.create_subscriptions_from_order(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscriptions_from_order(uuid,jsonb) TO authenticated, service_role;

-- RPC : apply_payment_to_invoice ---------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(
  p_invoice_id uuid, p_amount numeric, p_method text, p_provider text,
  p_external_reference text, p_source text, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_payment_id uuid; v_customer_id uuid; v_new_paid numeric(10,2); v_total numeric(10,2);
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Montant requis' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT customer_id, total, amount_paid INTO v_customer_id, v_total, v_new_paid
    FROM public.billing_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Facture % introuvable', p_invoice_id USING ERRCODE='no_data_found'; END IF;
  INSERT INTO public.billing_payments (
    invoice_id, customer_id, amount, payment_method, provider, external_reference, source, status, processed_at
  ) VALUES (
    p_invoice_id, v_customer_id, p_amount, p_method, p_provider, p_external_reference, p_source, 'completed', now()
  ) RETURNING id INTO v_payment_id;
  v_new_paid := COALESCE(v_new_paid,0) + p_amount;
  UPDATE public.billing_invoices
     SET amount_paid = v_new_paid,
         paid_at = CASE WHEN v_new_paid >= v_total THEN now() ELSE paid_at END,
         status  = CASE WHEN v_new_paid >= v_total THEN 'paid'::billing_invoice_status ELSE status END
   WHERE id = p_invoice_id;
  PERFORM public._nivra_record_provenance('billing_payment', v_payment_id, 'created', 'apply_payment_to_invoice', p_context,
    'billing_invoice', p_invoice_id, jsonb_build_object('amount',p_amount,'method',p_method,'provider',p_provider,'reference',p_external_reference));
  RETURN v_payment_id;
END; $$;
REVOKE ALL ON FUNCTION public.apply_payment_to_invoice(uuid,numeric,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_to_invoice(uuid,numeric,text,text,text,text,jsonb) TO authenticated, service_role;

-- RPC : apply_credit_to_invoice ----------------------------------------
CREATE OR REPLACE FUNCTION public.apply_credit_to_invoice(
  p_invoice_id uuid, p_credit_id uuid, p_amount numeric, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_line_id uuid; v_customer_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT customer_id INTO v_customer_id FROM public.billing_invoices WHERE id = p_invoice_id;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Facture % introuvable', p_invoice_id USING ERRCODE='no_data_found'; END IF;
  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, metadata
  ) VALUES (
    p_invoice_id, 'Application de crédit', -p_amount, 1, -p_amount,
    'credit', 'credit_application', 'credit_application',
    jsonb_build_object('credit_id', p_credit_id)
  ) RETURNING id INTO v_line_id;
  UPDATE public.billing_invoices SET amount_paid = COALESCE(amount_paid,0) + p_amount WHERE id = p_invoice_id;
  PERFORM public._nivra_record_provenance('billing_invoice_line', v_line_id, 'created', 'apply_credit_to_invoice', p_context,
    'account_adjustment', p_credit_id, jsonb_build_object('amount',p_amount));
  RETURN v_line_id;
END; $$;
REVOKE ALL ON FUNCTION public.apply_credit_to_invoice(uuid,uuid,numeric,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_credit_to_invoice(uuid,uuid,numeric,jsonb) TO authenticated, service_role;

-- RPC : apply_promotion_to_order_item ----------------------------------
CREATE OR REPLACE FUNCTION public.apply_promotion_to_order_item(
  p_order_item_id uuid, p_promotion_id uuid, p_amount numeric, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_line_id uuid; v_invoice_id uuid; v_order_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide' USING ERRCODE='invalid_parameter_value'; END IF;
  SELECT order_id INTO v_order_id FROM public.order_items WHERE id = p_order_item_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'order_item % introuvable', p_order_item_id USING ERRCODE='no_data_found'; END IF;
  SELECT id INTO v_invoice_id FROM public.billing_invoices WHERE order_id = v_order_id AND status NOT IN ('void','cancelled') LIMIT 1;
  IF v_invoice_id IS NULL THEN RAISE EXCEPTION 'Aucune facture active pour commande %', v_order_id USING ERRCODE='no_data_found'; END IF;
  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, source_order_item_id, metadata
  ) VALUES (
    v_invoice_id, 'Promotion appliquée', -p_amount, 1, -p_amount,
    'discount', 'promotion_applied', 'promotion', p_order_item_id,
    jsonb_build_object('promotion_id', p_promotion_id)
  ) RETURNING id INTO v_line_id;
  PERFORM public._nivra_record_provenance('billing_invoice_line', v_line_id, 'created', 'apply_promotion_to_order_item', p_context,
    'order_item', p_order_item_id, jsonb_build_object('promotion_id',p_promotion_id,'amount',p_amount));
  RETURN v_line_id;
END; $$;
REVOKE ALL ON FUNCTION public.apply_promotion_to_order_item(uuid,uuid,numeric,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_promotion_to_order_item(uuid,uuid,numeric,jsonb) TO authenticated, service_role;

-- RPC : renew_subscription ---------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_subscription(p_subscription_id uuid, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_sub public.billing_subscriptions%ROWTYPE; v_invoice_id uuid; v_subtotal numeric(10,2);
  v_gst_rate numeric(6,4) := 0.0500; v_qst_rate numeric(6,4) := 0.09975;
  v_gst numeric(10,2); v_qst numeric(10,2); v_total numeric(10,2); v_invoice_number text;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_subscription_id USING ERRCODE='no_data_found'; END IF;
  IF v_sub.frozen_unit_price IS NULL OR v_sub.frozen_name IS NULL THEN
    RAISE EXCEPTION 'Abonnement % sans données figées', p_subscription_id USING ERRCODE='check_violation';
  END IF;
  v_subtotal := v_sub.frozen_unit_price;
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);
  v_invoice_number := 'INV-RNW-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  INSERT INTO public.billing_invoices (
    customer_id, invoice_number, status, subscription_id,
    subtotal, tps_amount, tvq_amount, total,
    tax_gst_rate, tax_qst_rate, tax_snapshot, amount_paid
  ) VALUES (
    v_sub.customer_id, v_invoice_number, 'pending', v_sub.id,
    v_subtotal, v_gst, v_qst, v_total, v_gst_rate, v_qst_rate,
    jsonb_build_object('gst_rate',v_gst_rate,'qst_rate',v_qst_rate,'gst_amount',v_gst,'qst_amount',v_qst,'jurisdiction','QC','computed_at',now(),'source','renewal_frozen'),
    0
  ) RETURNING id INTO v_invoice_id;
  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total,
    line_type, source_ref, line_kind, source_order_item_id, metadata
  ) VALUES (
    v_invoice_id, v_sub.frozen_name || ' — Renouvellement',
    v_sub.frozen_unit_price, 1, v_sub.frozen_unit_price,
    'service', 'order_item', 'product_recurring', v_sub.source_order_item_id,
    jsonb_build_object('subscription_id', v_sub.id, 'renewal', true)
  );
  UPDATE public.billing_subscriptions
     SET last_invoice_id = v_invoice_id,
         cycle_start_date = COALESCE(cycle_end_date, CURRENT_DATE),
         cycle_end_date   = COALESCE(cycle_end_date, CURRENT_DATE) + INTERVAL '1 month'
   WHERE id = v_sub.id;
  PERFORM public._nivra_record_provenance('billing_invoice', v_invoice_id, 'renewal_created', 'renew_subscription', p_context,
    'billing_subscription', v_sub.id, jsonb_build_object('frozen_price',v_sub.frozen_unit_price,'total',v_total));
  RETURN v_invoice_id;
END; $$;
REVOKE ALL ON FUNCTION public.renew_subscription(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_subscription(uuid,jsonb) TO authenticated, service_role;

-- RPC : close_and_supersede_subscription -------------------------------
CREATE OR REPLACE FUNCTION public.close_and_supersede_subscription(
  p_old_subscription_id uuid, p_new_order_item_id uuid, p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old public.billing_subscriptions%ROWTYPE; v_item public.order_items%ROWTYPE; v_new_sub_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.billing_subscriptions WHERE id = p_old_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement % introuvable', p_old_subscription_id USING ERRCODE='no_data_found'; END IF;
  SELECT * INTO v_item FROM public.order_items WHERE id = p_new_order_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_item % introuvable', p_new_order_item_id USING ERRCODE='no_data_found'; END IF;
  IF v_item.is_recurring IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'order_item % non récurrent', p_new_order_item_id USING ERRCODE='check_violation';
  END IF;
  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price, service_category, order_id, environment, status,
    source_order_item_id, frozen_name, frozen_code, frozen_unit_price,
    frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date,
    supersedes_subscription_id, source_type, source_id
  ) VALUES (
    v_old.customer_id, COALESCE(v_item.plan_code, v_item.service_type::text),
    v_item.plan_name, v_item.unit_price, v_item.service_type::text, v_item.order_id, v_old.environment, 'pending',
    v_item.id, v_item.plan_name, COALESCE(v_item.plan_code, v_item.service_type::text), v_item.unit_price,
    'CAD', 'monthly', 'monthly', CURRENT_DATE, v_old.id, 'plan_change', v_old.id::text
  ) RETURNING id INTO v_new_sub_id;
  UPDATE public.billing_subscriptions
     SET status = 'cancelled'::billing_subscription_status,
         superseded_by_subscription_id = v_new_sub_id,
         cycle_end_date = CURRENT_DATE
   WHERE id = v_old.id;
  PERFORM public._nivra_record_provenance('billing_subscription', v_new_sub_id, 'created_via_plan_change', 'close_and_supersede_subscription', p_context,
    'billing_subscription', v_old.id, jsonb_build_object('old_price',v_old.frozen_unit_price,'new_price',v_item.unit_price));
  RETURN v_new_sub_id;
END; $$;
REVOKE ALL ON FUNCTION public.close_and_supersede_subscription(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_and_supersede_subscription(uuid,uuid,jsonb) TO authenticated, service_role;
