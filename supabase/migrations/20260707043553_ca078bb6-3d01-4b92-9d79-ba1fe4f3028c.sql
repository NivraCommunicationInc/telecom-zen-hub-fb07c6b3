-- =====================================================================
-- PHASE 3.A — RPC CANONIQUES COMPLÉMENTAIRES (AD-HOC)
-- Complète le noyau Phase 2 pour couvrir les 2 derniers cas du lot 3.A :
--   • billing-create-subscription (activation ad-hoc d'abonnement)
--   • billing-create-prorata-invoice (facture prorata multi-services)
-- Aucune Edge Function du lot 3.A n'écrira plus directement dans les
-- tables billing_* après cette migration + les réécritures associées.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC : build_invoice_ad_hoc
-- Crée une facture canonique à partir de lignes fournies (jsonb).
-- Utilisée quand il n'existe pas d'order_id (activation, prorata).
-- Format des lignes :
--   [{
--      "description": "…",
--      "unit_price":  10.00,      // numeric
--      "quantity":    1,          // integer
--      "line_total":  10.00,      // numeric, doit égaler unit_price*quantity
--      "line_type":   "service" | "fee" | "equipment" | "discount" | "credit",
--      "line_kind":   "product_recurring" | "product_one_time" | "equipment"
--                     | "activation_fee" | "prorata" | "credit_application"
--                     | "promo_discount" | "welcome_discount",
--      "service_address_id": "…", // optionnel
--      "metadata":    { … }       // optionnel
--   }, …]
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_invoice_ad_hoc(
  p_customer_id      uuid,
  p_subscription_id  uuid,
  p_type             text,
  p_cycle_start      date,
  p_cycle_end        date,
  p_due_date         date,
  p_lines            jsonb,
  p_context          jsonb DEFAULT '{}'::jsonb,
  p_order_id         uuid  DEFAULT NULL,
  p_notes            text  DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id     uuid;
  v_invoice_number text;
  v_subtotal       numeric(10,2) := 0;
  v_gst_rate       numeric(6,4)  := 0.0500;
  v_qst_rate       numeric(6,4)  := 0.09975;
  v_gst            numeric(10,2);
  v_qst            numeric(10,2);
  v_total          numeric(10,2);
  v_line           jsonb;
  v_line_total     numeric(10,2);
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'p_customer_id requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'p_lines doit être un tableau JSON non vide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotence : si un order_id est fourni et qu'une facture non-annulée existe déjà, la renvoyer.
  IF p_order_id IS NOT NULL THEN
    SELECT id INTO v_invoice_id
      FROM public.billing_invoices
     WHERE order_id = p_order_id
       AND status NOT IN ('void','cancelled')
     LIMIT 1;
    IF v_invoice_id IS NOT NULL THEN
      RETURN v_invoice_id;
    END IF;
  END IF;

  -- Calcul du subtotal à partir des lignes fournies (source de vérité unique).
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_line_total := ROUND(COALESCE((v_line->>'line_total')::numeric, 0), 2);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_subtotal := ROUND(v_subtotal, 2);
  v_gst := ROUND(v_subtotal * v_gst_rate, 2);
  v_qst := ROUND(v_subtotal * v_qst_rate, 2);
  v_total := ROUND(v_subtotal + v_gst + v_qst, 2);

  -- Numéro de facture canonique
  BEGIN
    SELECT public.generate_billing_invoice_number() INTO v_invoice_number;
  EXCEPTION WHEN undefined_function THEN
    v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  END;
  IF v_invoice_number IS NULL THEN
    v_invoice_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8);
  END IF;

  INSERT INTO public.billing_invoices (
    customer_id, subscription_id, order_id, invoice_number,
    type, status, currency,
    subtotal, tps_amount, tvq_amount, total,
    tax_gst_rate, tax_qst_rate, tax_snapshot,
    cycle_start_date, cycle_end_date, due_date, notes, amount_paid
  ) VALUES (
    p_customer_id, p_subscription_id, p_order_id, v_invoice_number,
    COALESCE(NULLIF(p_type,''), 'initial'), 'pending', 'CAD',
    v_subtotal, v_gst, v_qst, v_total,
    v_gst_rate, v_qst_rate,
    jsonb_build_object(
      'gst_rate', v_gst_rate,
      'qst_rate', v_qst_rate,
      'gst_amount', v_gst,
      'qst_amount', v_qst,
      'jurisdiction', 'QC',
      'computed_at', now()
    ),
    p_cycle_start, p_cycle_end, p_due_date, p_notes, 0
  ) RETURNING id INTO v_invoice_id;

  -- Insertion des lignes
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.billing_invoice_lines (
      invoice_id, description,
      unit_price, quantity, line_total,
      line_type, line_kind, source_ref,
      service_address_id, metadata
    ) VALUES (
      v_invoice_id,
      COALESCE(v_line->>'description', 'Ligne'),
      ROUND(COALESCE((v_line->>'unit_price')::numeric, 0), 4),
      COALESCE((v_line->>'quantity')::int, 1),
      ROUND(COALESCE((v_line->>'line_total')::numeric, 0), 2),
      COALESCE(v_line->>'line_type', 'service'),
      COALESCE(v_line->>'line_kind', 'product_one_time'),
      COALESCE(v_line->>'source_ref', 'ad_hoc'),
      NULLIF(v_line->>'service_address_id','')::uuid,
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  PERFORM public._nivra_record_provenance(
    'billing_invoice', v_invoice_id, 'created', 'build_invoice_ad_hoc', p_context,
    CASE WHEN p_order_id IS NOT NULL THEN 'order' ELSE 'billing_subscription' END,
    COALESCE(p_order_id, p_subscription_id),
    jsonb_build_object('subtotal', v_subtotal, 'total', v_total,
                       'line_count', jsonb_array_length(p_lines))
  );

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.build_invoice_ad_hoc(uuid,uuid,text,date,date,date,jsonb,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_invoice_ad_hoc(uuid,uuid,text,date,date,date,jsonb,jsonb,uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- RPC : create_subscription_ad_hoc
-- Crée un abonnement canonique hors flux commande.
-- Le prix est immédiatement figé dans les colonnes frozen_*.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_subscription_ad_hoc(
  p_customer_id       uuid,
  p_plan_code         text,
  p_plan_name         text,
  p_plan_price        numeric,
  p_service_category  text,
  p_cycle_start       date,
  p_cycle_end         date,
  p_context           jsonb DEFAULT '{}'::jsonb,
  p_address_id        uuid  DEFAULT NULL,
  p_order_id          uuid  DEFAULT NULL,
  p_status            text  DEFAULT 'pending',
  p_auto_billing      boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub_id     uuid;
  v_anchor_day int;
BEGIN
  IF p_customer_id IS NULL OR p_plan_code IS NULL OR p_plan_name IS NULL THEN
    RAISE EXCEPTION 'customer_id, plan_code et plan_name requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_plan_price IS NULL OR p_plan_price < 0 THEN
    RAISE EXCEPTION 'plan_price invalide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_anchor_day := EXTRACT(DAY FROM p_cycle_start)::int;

  -- Idempotence : si un order_id est fourni et qu'un abonnement existe, le renvoyer.
  IF p_order_id IS NOT NULL THEN
    SELECT id INTO v_sub_id
      FROM public.billing_subscriptions
     WHERE order_id = p_order_id
       AND customer_id = p_customer_id
       AND (p_service_category IS NULL OR service_category = p_service_category)
     ORDER BY created_at DESC
     LIMIT 1;
    IF v_sub_id IS NOT NULL THEN
      RETURN v_sub_id;
    END IF;
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price, service_category,
    cycle_start_date, cycle_end_date, billing_anchor_date,
    status, auto_billing_enabled, order_id, address_id, environment,
    frozen_name, frozen_code, frozen_unit_price,
    frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date,
    source_type, source_id
  ) VALUES (
    p_customer_id, p_plan_code, p_plan_name, ROUND(p_plan_price,2), p_service_category,
    p_cycle_start, p_cycle_end, p_cycle_start,
    COALESCE(p_status,'pending'), COALESCE(p_auto_billing,false),
    p_order_id, p_address_id, 'live',
    p_plan_name, p_plan_code, ROUND(p_plan_price,2),
    'CAD', 'monthly', 'monthly', p_cycle_start,
    COALESCE(NULLIF(p_context->>'source_type',''), 'ad_hoc'),
    NULLIF(p_context->>'source_id','')
  ) RETURNING id INTO v_sub_id;

  PERFORM public._nivra_record_provenance(
    'billing_subscription', v_sub_id, 'created', 'create_subscription_ad_hoc', p_context,
    CASE WHEN p_order_id IS NOT NULL THEN 'order' ELSE NULL END,
    p_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'plan_name', p_plan_name, 'plan_price', p_plan_price)
  );

  RETURN v_sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subscription_ad_hoc(uuid,text,text,numeric,text,date,date,jsonb,uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscription_ad_hoc(uuid,text,text,numeric,text,date,date,jsonb,uuid,uuid,text,boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.build_invoice_ad_hoc IS
  'Phase 3.A — Crée une facture canonique à partir de lignes ad-hoc (sans order_items). Utilisée par billing-create-subscription et billing-create-prorata-invoice. Taxes figées automatiquement dans tax_snapshot.';
COMMENT ON FUNCTION public.create_subscription_ad_hoc IS
  'Phase 3.A — Crée un abonnement canonique hors flux commande. Le prix est figé dans frozen_* dès la création.';