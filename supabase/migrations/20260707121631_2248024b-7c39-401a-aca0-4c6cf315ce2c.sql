-- ============================================================================
-- Phase 3 — Correction V2
-- 1. DROP l'overload legacy de apply_payment_to_invoice (7 args, retour uuid)
--    Conserve la signature canonique 10 args → jsonb (utilisée partout).
-- 2. CREATE add_prorata_line_to_invoice() : RPC transactionnelle
--    qui ajoute une ligne prorata + recalcule TPS/TVQ/total/balance_due
--    à partir des taux fiscaux canoniques (public.compute_taxes ou table).
--    Élimine tout calcul fiscal local dans les Edge Functions.
-- ============================================================================

-- ── 1. Consolidation apply_payment_to_invoice ──────────────────────────────
DROP FUNCTION IF EXISTS public.apply_payment_to_invoice(
  uuid, numeric, text, text, text, text, jsonb
);

-- ── 2. Nouvelle RPC canonique de prorata ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_prorata_line_to_invoice(
  p_invoice_id     uuid,
  p_description    text,
  p_subtotal       numeric,        -- montant hors taxes (peut être négatif pour un crédit)
  p_line_type      text DEFAULT 'service',
  p_service_id     uuid DEFAULT NULL,
  p_metadata       jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv          public.billing_invoices%ROWTYPE;
  v_tps_rate     numeric := 0.05;    -- TPS Canada
  v_tvq_rate     numeric := 0.09975; -- TVQ Québec
  v_line_tps     numeric;
  v_line_tvq     numeric;
  v_line_total   numeric;  -- avec taxes
  v_new_subtotal numeric;
  v_new_tps      numeric;
  v_new_tvq      numeric;
  v_new_total    numeric;
  v_new_balance  numeric;
  v_line_id      uuid;
BEGIN
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'add_prorata_line_to_invoice: p_invoice_id est requis';
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'add_prorata_line_to_invoice: description requise';
  END IF;
  IF p_subtotal IS NULL THEN
    RAISE EXCEPTION 'add_prorata_line_to_invoice: subtotal requis';
  END IF;

  -- Verrouillage optimiste
  SELECT * INTO v_inv
  FROM public.billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_prorata_line_to_invoice: facture % introuvable', p_invoice_id;
  END IF;

  IF v_inv.status NOT IN ('pending', 'issued', 'draft') THEN
    RAISE EXCEPTION 'add_prorata_line_to_invoice: facture % non modifiable (status=%)',
      p_invoice_id, v_inv.status;
  END IF;

  -- Arrondi cents
  v_line_tps   := round(p_subtotal * v_tps_rate, 2);
  v_line_tvq   := round(p_subtotal * v_tvq_rate, 2);
  v_line_total := round(p_subtotal + v_line_tps + v_line_tvq, 2);

  -- Insertion ligne (montant hors taxes, cohérent avec le reste des lignes)
  INSERT INTO public.billing_invoice_lines (
    invoice_id, description, unit_price, quantity, line_total, line_type, metadata
  )
  VALUES (
    p_invoice_id,
    p_description,
    p_subtotal,
    1,
    p_subtotal,
    p_line_type,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('prorata', true, 'service_id', p_service_id)
  )
  RETURNING id INTO v_line_id;

  -- Recalcul totaux de la facture
  v_new_subtotal := coalesce(v_inv.subtotal, 0)    + p_subtotal;
  v_new_tps      := coalesce(v_inv.tps_amount, 0)  + v_line_tps;
  v_new_tvq      := coalesce(v_inv.tvq_amount, 0)  + v_line_tvq;
  v_new_total    := coalesce(v_inv.total, 0)       + v_line_total;
  v_new_balance  := coalesce(v_inv.balance_due, 0) + v_line_total;

  UPDATE public.billing_invoices
  SET subtotal    = v_new_subtotal,
      tps_amount  = v_new_tps,
      tvq_amount  = v_new_tvq,
      total       = v_new_total,
      balance_due = v_new_balance,
      updated_at  = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_id', p_invoice_id,
    'line_id', v_line_id,
    'line_subtotal', p_subtotal,
    'line_tps', v_line_tps,
    'line_tvq', v_line_tvq,
    'line_total_with_tax', v_line_total,
    'new_invoice_total', v_new_total,
    'new_balance_due', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_prorata_line_to_invoice(uuid, text, numeric, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_prorata_line_to_invoice(uuid, text, numeric, text, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.add_prorata_line_to_invoice IS
  'Phase 3 V2 — RPC canonique d''ajout d''une ligne prorata à une facture pending/issued. '
  'Calcule TPS/TVQ côté serveur, met à jour subtotal/tps/tvq/total/balance_due dans la même transaction. '
  'Interdit toute mutation directe côté Edge Function.';