-- ============================================================================
-- Phase 3.B.1 — Idempotence webhooks + traçabilité provider + refund canonique
-- ============================================================================
-- Fondation DB pour la migration des webhooks Square/PayPal :
--  1. Registre unique webhook_events_processed (idempotence globale, PK provider+event_id)
--  2. Colonnes de traçabilité complètes sur billing_payments
--  3. RPC record_webhook_event() — atomique, ON CONFLICT DO NOTHING
--  4. RPC apply_payment_from_webhook() — wrapper strict autour de apply_payment_to_invoice
--  5. RPC refund_payment() — refund = billing_payment de type refund, JAMAIS un adjustment
--  6. Triggers d'invariants : refund interdit dans account_adjustments et invoice_lines

-- ─────────────────────────────────────────────────────────────
-- 1) Registre unique des événements webhook
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events_processed (
  provider              text        NOT NULL,
  event_id              text        NOT NULL,
  provider_event_type   text,
  provider_created_at   timestamptz,
  received_at           timestamptz NOT NULL DEFAULT now(),
  processed_at          timestamptz NOT NULL DEFAULT now(),
  rpc_used              text,
  invoice_id            uuid,
  payment_id            uuid,
  payload_hash          text,
  outcome               text        NOT NULL DEFAULT 'accepted',
  PRIMARY KEY (provider, event_id)
);

GRANT SELECT ON public.webhook_events_processed TO authenticated;
GRANT ALL    ON public.webhook_events_processed TO service_role;

ALTER TABLE public.webhook_events_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_admin_read"
  ON public.webhook_events_processed
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS webhook_events_provider_received_idx
  ON public.webhook_events_processed (provider, received_at DESC);

COMMENT ON TABLE public.webhook_events_processed IS
  '3.B.1 — Registre unique des événements webhook (idempotence globale). PK (provider,event_id). Toute écriture de billing_payment issue d''un webhook doit passer par apply_payment_from_webhook() ou refund_payment().';

-- ─────────────────────────────────────────────────────────────
-- 2) Traçabilité provider complète sur billing_payments
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS provider_event_id   text,
  ADD COLUMN IF NOT EXISTS provider_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS rpc_used            text,
  ADD COLUMN IF NOT EXISTS payment_kind        text NOT NULL DEFAULT 'capture';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_payments_kind_chk'
  ) THEN
    ALTER TABLE public.billing_payments
      ADD CONSTRAINT billing_payments_kind_chk
      CHECK (payment_kind IN ('capture','refund','chargeback'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_provider_event_unique
  ON public.billing_payments (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_payments_kind_idx
  ON public.billing_payments (payment_kind);

COMMENT ON COLUMN public.billing_payments.provider_event_id IS
  '3.B.1 — Identifiant unique de l''événement webhook fournisseur ayant produit ce paiement.';
COMMENT ON COLUMN public.billing_payments.rpc_used IS
  '3.B.1 — RPC canonique ayant écrit cette ligne (apply_payment_to_invoice / apply_payment_from_webhook / refund_payment).';

-- ─────────────────────────────────────────────────────────────
-- 3) RPC : record_webhook_event (atomique, idempotent)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_webhook_event(
  p_provider            text,
  p_event_id            text,
  p_event_type          text        DEFAULT NULL,
  p_provider_created_at timestamptz DEFAULT NULL,
  p_payload_hash        text        DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_rows int;
BEGIN
  IF p_provider IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'provider et event_id requis'
      USING ERRCODE='invalid_parameter_value';
  END IF;
  INSERT INTO public.webhook_events_processed (
    provider, event_id, provider_event_type, provider_created_at, payload_hash
  ) VALUES (
    p_provider, p_event_id, p_event_type, p_provider_created_at, p_payload_hash
  )
  ON CONFLICT (provider, event_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END; $$;

REVOKE ALL   ON FUNCTION public.record_webhook_event(text,text,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_webhook_event(text,text,text,timestamptz,text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) RPC : apply_payment_from_webhook — idempotence + délégation stricte
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_payment_from_webhook(
  p_provider            text,
  p_event_id            text,
  p_event_type          text,
  p_provider_created_at timestamptz,
  p_invoice_id          uuid,
  p_amount              numeric,
  p_method              text,
  p_external_reference  text,
  p_source              text  DEFAULT 'webhook',
  p_context             jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_new        boolean;
  v_payment_id uuid;
BEGIN
  -- Étape 1 : verrou d'idempotence AVANT toute écriture billing
  v_new := public.record_webhook_event(
    p_provider, p_event_id, p_event_type, p_provider_created_at, NULL
  );

  IF NOT v_new THEN
    SELECT payment_id INTO v_payment_id
      FROM public.webhook_events_processed
     WHERE provider = p_provider AND event_id = p_event_id;
    RETURN v_payment_id;  -- déjà traité, aucune écriture
  END IF;

  -- Étape 2 : délégation stricte à la RPC canonique
  v_payment_id := public.apply_payment_to_invoice(
    p_invoice_id, p_amount, p_method, p_provider, p_external_reference, p_source,
    COALESCE(p_context,'{}'::jsonb) || jsonb_build_object(
      'webhook_event_id',   p_event_id,
      'webhook_event_type', p_event_type,
      'webhook_provider',   p_provider
    )
  );

  -- Étape 3 : traçabilité provider complète
  UPDATE public.billing_payments
     SET provider_event_id   = p_event_id,
         provider_created_at = p_provider_created_at,
         processed_at        = now(),
         rpc_used            = 'apply_payment_from_webhook',
         payment_kind        = 'capture'
   WHERE id = v_payment_id;

  UPDATE public.webhook_events_processed
     SET invoice_id   = p_invoice_id,
         payment_id   = v_payment_id,
         rpc_used     = 'apply_payment_from_webhook',
         processed_at = now()
   WHERE provider = p_provider AND event_id = p_event_id;

  RETURN v_payment_id;
END; $$;

REVOKE ALL   ON FUNCTION public.apply_payment_from_webhook(text,text,text,timestamptz,uuid,numeric,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_from_webhook(text,text,text,timestamptz,uuid,numeric,text,text,text,jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC : refund_payment — canal UNIQUE pour tous les remboursements
--        - JAMAIS account_adjustments
--        - JAMAIS ligne de facture négative
--        - JAMAIS promotion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_payment(
  p_provider            text,
  p_event_id            text,
  p_original_payment_id uuid,
  p_amount              numeric,
  p_external_reference  text,
  p_reason              text        DEFAULT NULL,
  p_provider_created_at timestamptz DEFAULT NULL,
  p_context             jsonb       DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_new           boolean;
  v_refund_id     uuid;
  v_orig          record;
  v_signed_amount numeric(10,2);
  v_new_paid      numeric(10,2);
  v_invoice_total numeric(10,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide (doit être > 0, en valeur absolue)'
      USING ERRCODE='invalid_parameter_value';
  END IF;

  -- Idempotence
  v_new := public.record_webhook_event(p_provider, p_event_id, 'refund', p_provider_created_at, NULL);
  IF NOT v_new THEN
    SELECT payment_id INTO v_refund_id
      FROM public.webhook_events_processed
     WHERE provider = p_provider AND event_id = p_event_id;
    RETURN v_refund_id;
  END IF;

  -- Charger le paiement original
  SELECT id, invoice_id, customer_id, method, provider
    INTO v_orig
    FROM public.billing_payments
   WHERE id = p_original_payment_id
   FOR UPDATE;
  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Paiement original introuvable: %', p_original_payment_id
      USING ERRCODE='no_data_found';
  END IF;

  v_signed_amount := -1 * abs(p_amount);

  -- Refund = billing_payment de type refund (montant négatif, kind='refund')
  INSERT INTO public.billing_payments (
    invoice_id, customer_id, amount, method, provider, reference,
    source, authorization_status, received_at,
    provider_event_id, provider_created_at, processed_at, rpc_used, payment_kind
  ) VALUES (
    v_orig.invoice_id, v_orig.customer_id, v_signed_amount,
    v_orig.method, v_orig.provider, p_external_reference,
    'webhook', 'refunded', now(),
    p_event_id, p_provider_created_at, now(), 'refund_payment', 'refund'
  ) RETURNING id INTO v_refund_id;

  -- Réajuster la facture (jamais via invoice_lines)
  SELECT total, amount_paid INTO v_invoice_total, v_new_paid
    FROM public.billing_invoices WHERE id = v_orig.invoice_id FOR UPDATE;
  v_new_paid := GREATEST(COALESCE(v_new_paid,0) - abs(p_amount), 0);
  UPDATE public.billing_invoices
     SET amount_paid = v_new_paid,
         status = CASE
           WHEN v_new_paid <= 0 THEN 'sent'::billing_invoice_status
           WHEN v_new_paid < v_invoice_total THEN 'partially_paid'::billing_invoice_status
           ELSE status
         END,
         paid_at = CASE WHEN v_new_paid < v_invoice_total THEN NULL ELSE paid_at END
   WHERE id = v_orig.invoice_id;

  PERFORM public._nivra_record_provenance(
    'billing_payment', v_refund_id, 'created', 'refund_payment', p_context,
    'billing_payment', p_original_payment_id,
    jsonb_build_object(
      'amount', p_amount, 'reason', p_reason,
      'webhook_event_id', p_event_id, 'webhook_provider', p_provider
    )
  );

  UPDATE public.webhook_events_processed
     SET invoice_id   = v_orig.invoice_id,
         payment_id   = v_refund_id,
         rpc_used     = 'refund_payment',
         processed_at = now()
   WHERE provider = p_provider AND event_id = p_event_id;

  RETURN v_refund_id;
END; $$;

REVOKE ALL   ON FUNCTION public.refund_payment(text,text,uuid,numeric,text,text,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_payment(text,text,uuid,numeric,text,text,timestamptz,jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 6) INVARIANT : un remboursement N'EST JAMAIS un account_adjustment
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_refund_as_adjustment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF lower(COALESCE(NEW.type,'')) IN ('refund','reimbursement','remboursement','chargeback')
     OR lower(COALESCE(NEW.description,'')) LIKE '%refund%'
     OR lower(COALESCE(NEW.description,'')) LIKE '%remboursement%'
     OR lower(COALESCE(NEW.description,'')) LIKE '%chargeback%' THEN
    RAISE EXCEPTION
      'INVARIANT-3B1: un remboursement doit passer par refund_payment(), jamais account_adjustments (type=%, description=%)',
      NEW.type, NEW.description
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_forbid_refund_as_adjustment ON public.account_adjustments;
CREATE TRIGGER trg_forbid_refund_as_adjustment
  BEFORE INSERT OR UPDATE ON public.account_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_refund_as_adjustment();

-- ─────────────────────────────────────────────────────────────
-- 7) INVARIANT : un remboursement N'EST JAMAIS une invoice_line négative
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_negative_invoice_line_refund()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.line_total < 0 AND (
       lower(COALESCE(NEW.description,''))       LIKE '%refund%'        OR
       lower(COALESCE(NEW.description,''))       LIKE '%remboursement%' OR
       lower(COALESCE(NEW.description,''))       LIKE '%chargeback%'    OR
       lower(COALESCE(NEW.line_kind::text,''))  IN ('refund','chargeback','reimbursement') OR
       lower(COALESCE(NEW.line_type::text,''))  IN ('refund','chargeback','reimbursement')
     ) THEN
    RAISE EXCEPTION
      'INVARIANT-3B1: un remboursement ne peut pas être une ligne de facture négative — utiliser refund_payment()'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_forbid_negative_invoice_line_refund ON public.billing_invoice_lines;
CREATE TRIGGER trg_forbid_negative_invoice_line_refund
  BEFORE INSERT OR UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_negative_invoice_line_refund();

-- ─────────────────────────────────────────────────────────────
-- 8) INVARIANT : un remboursement N'EST JAMAIS une promotion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_refund_as_promotion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF lower(COALESCE(NEW.description,'')) LIKE '%refund%'
     OR lower(COALESCE(NEW.description,'')) LIKE '%remboursement%'
     OR lower(COALESCE(NEW.description,'')) LIKE '%chargeback%' THEN
    RAISE EXCEPTION
      'INVARIANT-3B1: un remboursement ne peut pas être une promotion — utiliser refund_payment()'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_forbid_refund_as_promotion ON public.account_promotions;
CREATE TRIGGER trg_forbid_refund_as_promotion
  BEFORE INSERT OR UPDATE ON public.account_promotions
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_refund_as_promotion();