
-- =====================================================================
-- PHASE 1 — INVARIANTS BASE DE DONNÉES (refonte facturation)
-- Règles 1..5 : source de vérité unique, aucune fabrication de lignes,
-- séparation stricte des concepts financiers, abonnements figés.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. billing_invoice_lines — colonnes canoniques
-- ---------------------------------------------------------------------
ALTER TABLE public.billing_invoice_lines
  ADD COLUMN IF NOT EXISTS source_ref            text,
  ADD COLUMN IF NOT EXISTS line_kind             text,
  ADD COLUMN IF NOT EXISTS source_order_item_id  uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id    uuid,
  ADD COLUMN IF NOT EXISTS adjustment_reason     text;

-- Backfill des lignes existantes : marquées 'legacy' pour être exemptées.
UPDATE public.billing_invoice_lines
   SET source_ref = COALESCE(source_ref, 'legacy'),
       line_kind  = COALESCE(line_kind,  'legacy');

-- Défaut pour toute nouvelle insertion qui n'aurait pas déclaré la source.
ALTER TABLE public.billing_invoice_lines
  ALTER COLUMN source_ref SET DEFAULT 'unspecified',
  ALTER COLUMN line_kind  SET DEFAULT 'unspecified',
  ALTER COLUMN source_ref SET NOT NULL,
  ALTER COLUMN line_kind  SET NOT NULL;

-- Valeurs autorisées (contraintes NOT VALID pour épargner l'historique)
ALTER TABLE public.billing_invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_line_source_ref;
ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT chk_invoice_line_source_ref
  CHECK (source_ref IN (
    'legacy',
    'order_item',
    'manual_admin',
    'credit_application',
    'payment_application',
    'tax',
    'promotion_applied',
    'system_migration'
  )) NOT VALID;
ALTER TABLE public.billing_invoice_lines
  VALIDATE CONSTRAINT chk_invoice_line_source_ref;

ALTER TABLE public.billing_invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_line_kind;
ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT chk_invoice_line_kind
  CHECK (line_kind IN (
    'legacy',
    'product_recurring',
    'product_one_time',
    'equipment',
    'activation_fee',
    'shipping',
    'travel_fee',
    'installation_fee',
    'promotion',
    'discount',
    'tax',
    'credit_application',
    'payment_application',
    'manual_adjustment'
  )) NOT VALID;
ALTER TABLE public.billing_invoice_lines
  VALIDATE CONSTRAINT chk_invoice_line_kind;

-- Règle 3 : montant négatif interdit sauf sur les catégories qui ont
-- un sens à être négatives (rabais, promotion, application de crédit,
-- application de paiement). Les lignes 'legacy' sont exemptées.
ALTER TABLE public.billing_invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_line_amount_sign;
ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT chk_invoice_line_amount_sign
  CHECK (
    line_kind = 'legacy'
    OR line_kind IN ('promotion','discount','credit_application','payment_application')
    OR (unit_price >= 0 AND line_total >= 0)
  ) NOT VALID;
ALTER TABLE public.billing_invoice_lines
  VALIDATE CONSTRAINT chk_invoice_line_amount_sign;

-- Une ligne d'ajustement manuel exige un auteur et une raison.
ALTER TABLE public.billing_invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_line_manual_traceability;
ALTER TABLE public.billing_invoice_lines
  ADD CONSTRAINT chk_invoice_line_manual_traceability
  CHECK (
    line_kind <> 'manual_adjustment'
    OR (created_by_user_id IS NOT NULL AND adjustment_reason IS NOT NULL AND length(btrim(adjustment_reason)) >= 5)
  );

-- Trigger : bloquer l'insertion de nouvelles lignes 'legacy'/'unspecified'.
-- L'historique est préservé, mais aucune nouvelle ligne fantôme ne peut être créée.
CREATE OR REPLACE FUNCTION public.fn_invoice_line_reject_unspecified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_ref IN ('legacy','unspecified') THEN
    RAISE EXCEPTION
      'billing_invoice_lines: source_ref ''%'' interdit pour un nouvel enregistrement. '
      'Utilise order_item, manual_admin, credit_application, payment_application, tax, promotion_applied ou system_migration.',
      NEW.source_ref
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.line_kind IN ('legacy','unspecified') THEN
    RAISE EXCEPTION
      'billing_invoice_lines: line_kind ''%'' interdit pour un nouvel enregistrement.',
      NEW.line_kind
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cohérence source_ref <-> line_kind pour les cas critiques (règle 3).
  IF NEW.source_ref = 'payment_application' AND NEW.line_kind <> 'payment_application' THEN
    RAISE EXCEPTION 'Un paiement reçu doit avoir line_kind=payment_application, jamais un rabais.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.source_ref = 'credit_application' AND NEW.line_kind <> 'credit_application' THEN
    RAISE EXCEPTION 'Un crédit appliqué doit avoir line_kind=credit_application, jamais un rabais.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_line_reject_unspecified ON public.billing_invoice_lines;
CREATE TRIGGER trg_invoice_line_reject_unspecified
  BEFORE INSERT ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_line_reject_unspecified();

-- ---------------------------------------------------------------------
-- 2. billing_subscriptions — abonnements figés, source obligatoire
-- ---------------------------------------------------------------------
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS source_order_item_id         uuid REFERENCES public.order_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS frozen_name                  text,
  ADD COLUMN IF NOT EXISTS frozen_code                  text,
  ADD COLUMN IF NOT EXISTS frozen_unit_price            numeric(10,2),
  ADD COLUMN IF NOT EXISTS frozen_currency              text,
  ADD COLUMN IF NOT EXISTS frozen_cycle                 text,
  ADD COLUMN IF NOT EXISTS frozen_frequency             text,
  ADD COLUMN IF NOT EXISTS frozen_anchor_date           date,
  ADD COLUMN IF NOT EXISTS superseded_by_subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supersedes_subscription_id   uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL;

-- Backfill des abonnements existants à partir des données déjà présentes.
UPDATE public.billing_subscriptions
   SET frozen_name       = COALESCE(frozen_name, plan_name),
       frozen_code       = COALESCE(frozen_code, plan_code),
       frozen_unit_price = COALESCE(frozen_unit_price, plan_price),
       frozen_currency   = COALESCE(frozen_currency, 'CAD'),
       frozen_cycle      = COALESCE(frozen_cycle, 'monthly'),
       frozen_frequency  = COALESCE(frozen_frequency, 'monthly'),
       frozen_anchor_date = COALESCE(frozen_anchor_date, cycle_start_date, CURRENT_DATE);

-- Trigger : à la création, on exige la source order_item (record d'origine)
-- et cet order_item DOIT avoir is_recurring = true.
-- À l'update, les colonnes figées deviennent immuables.
CREATE OR REPLACE FUNCTION public.fn_subscription_freeze_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_recurring boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Règle 1 & 4 : chaque abonnement doit provenir d'une ligne de
    -- commande réellement vendue et récurrente.
    IF NEW.source_order_item_id IS NULL THEN
      RAISE EXCEPTION 'billing_subscriptions: source_order_item_id obligatoire (règle 1). '
                      'Un abonnement doit pointer vers un order_item vendu.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT is_recurring INTO v_is_recurring
      FROM public.order_items
     WHERE id = NEW.source_order_item_id;

    IF v_is_recurring IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'billing_subscriptions: l''order_item % n''est pas récurrent (règle 4). '
                      'Aucun abonnement ne peut être créé pour équipement, frais d''activation, '
                      'livraison, déplacement, taxe ou tout autre produit non récurrent.',
                      NEW.source_order_item_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Règle 5 : colonnes figées obligatoires.
    IF NEW.frozen_name IS NULL
       OR NEW.frozen_code IS NULL
       OR NEW.frozen_unit_price IS NULL
       OR NEW.frozen_currency IS NULL
       OR NEW.frozen_cycle IS NULL
       OR NEW.frozen_frequency IS NULL
       OR NEW.frozen_anchor_date IS NULL THEN
      RAISE EXCEPTION 'billing_subscriptions: les colonnes frozen_* sont obligatoires (règle 5). '
                      'Copie définitivement le nom, code, prix, devise, cycle, fréquence et date d''ancrage vendus.'
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE : colonnes figées immuables.
  IF NEW.frozen_name       IS DISTINCT FROM OLD.frozen_name       THEN
     RAISE EXCEPTION 'frozen_name immuable après création (règle 5).' USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_code       IS DISTINCT FROM OLD.frozen_code       THEN
     RAISE EXCEPTION 'frozen_code immuable après création (règle 5).' USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_unit_price IS DISTINCT FROM OLD.frozen_unit_price THEN
     RAISE EXCEPTION 'frozen_unit_price immuable — pour un changement de prix, crée un nouvel abonnement et clôture l''ancien via superseded_by_subscription_id (règle 5).'
       USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_currency   IS DISTINCT FROM OLD.frozen_currency   THEN
     RAISE EXCEPTION 'frozen_currency immuable après création.' USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_cycle      IS DISTINCT FROM OLD.frozen_cycle      THEN
     RAISE EXCEPTION 'frozen_cycle immuable — pour un changement de cycle, crée un nouvel abonnement.'
       USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_frequency  IS DISTINCT FROM OLD.frozen_frequency  THEN
     RAISE EXCEPTION 'frozen_frequency immuable après création.' USING ERRCODE='check_violation'; END IF;
  IF NEW.frozen_anchor_date IS DISTINCT FROM OLD.frozen_anchor_date THEN
     RAISE EXCEPTION 'frozen_anchor_date immuable après création.' USING ERRCODE='check_violation'; END IF;
  IF NEW.source_order_item_id IS DISTINCT FROM OLD.source_order_item_id THEN
     RAISE EXCEPTION 'source_order_item_id immuable après création (règle 1).' USING ERRCODE='check_violation'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_freeze_guard ON public.billing_subscriptions;
CREATE TRIGGER trg_subscription_freeze_guard
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_subscription_freeze_guard();

-- ---------------------------------------------------------------------
-- 3. Trigger d'intégrité commande <-> facture
--    Somme des lignes produit (non taxe / non paiement / non crédit)
--    doit égaler la somme des order_items associés (±0.05).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_invoice_matches_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id       uuid;
  v_lines_product  numeric(12,2);
  v_order_total    numeric(12,2);
BEGIN
  -- On ne contrôle que les factures liées à une commande.
  SELECT bi.order_id INTO v_order_id
    FROM public.billing_invoices bi
   WHERE bi.id = NEW.invoice_id;

  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO v_lines_product
    FROM public.billing_invoice_lines
   WHERE invoice_id = NEW.invoice_id
     AND line_kind IN ('product_recurring','product_one_time','equipment',
                       'activation_fee','shipping','travel_fee','installation_fee',
                       'promotion','discount');

  SELECT COALESCE(SUM(line_total), 0) INTO v_order_total
    FROM public.order_items
   WHERE order_id = v_order_id;

  -- On ne bloque que si l'écart est significatif ET qu'aucune ligne 'legacy'
  -- ne subsiste (période transitoire pour l'historique).
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_invoice_lines
     WHERE invoice_id = NEW.invoice_id AND line_kind = 'legacy'
  ) AND ABS(v_lines_product - v_order_total) > 0.05 THEN
    RAISE EXCEPTION
      'Facture % incohérente avec la commande % : lignes=% commande=% (écart % > 0,05 $). '
      'La facture ne peut pas contenir des lignes qui n''existent pas dans la commande.',
      NEW.invoice_id, v_order_id, v_lines_product, v_order_total, ABS(v_lines_product - v_order_total)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger DEFERRABLE : validé à la fin de la transaction pour permettre
-- l'insertion multi-lignes atomique via une RPC canonique.
DROP TRIGGER IF EXISTS trg_invoice_matches_order ON public.billing_invoice_lines;
CREATE CONSTRAINT TRIGGER trg_invoice_matches_order
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_invoice_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_matches_order();

-- ---------------------------------------------------------------------
-- 4. Vue d'audit d'intégrité (règle 7 — audit)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.billing_integrity_report
WITH (security_invoker = on)
AS
WITH invoice_stats AS (
  SELECT
    bi.id                                                              AS invoice_id,
    bi.invoice_number,
    bi.order_id,
    bi.total                                                           AS invoice_total,
    COALESCE(SUM(bil.line_total) FILTER (WHERE bil.line_kind = 'legacy'), 0)      AS legacy_lines_total,
    COUNT(*)         FILTER (WHERE bil.line_kind = 'legacy')                     AS legacy_lines_count,
    COALESCE(SUM(bil.line_total) FILTER (WHERE bil.line_kind IN (
        'product_recurring','product_one_time','equipment','activation_fee',
        'shipping','travel_fee','installation_fee','promotion','discount')), 0)   AS product_lines_total,
    (SELECT COALESCE(SUM(line_total),0) FROM public.order_items WHERE order_id = bi.order_id) AS order_items_total
  FROM public.billing_invoices bi
  LEFT JOIN public.billing_invoice_lines bil ON bil.invoice_id = bi.id
  GROUP BY bi.id, bi.invoice_number, bi.order_id, bi.total
)
SELECT
  invoice_id,
  invoice_number,
  order_id,
  invoice_total,
  legacy_lines_count,
  legacy_lines_total,
  product_lines_total,
  order_items_total,
  CASE
    WHEN order_id IS NULL                                            THEN 'no_order_link'
    WHEN legacy_lines_count > 0                                      THEN 'legacy_lines_present'
    WHEN ABS(product_lines_total - order_items_total) > 0.05         THEN 'mismatch_with_order'
    ELSE 'ok'
  END AS integrity_status
FROM invoice_stats;

GRANT SELECT ON public.billing_integrity_report TO authenticated;
GRANT SELECT ON public.billing_integrity_report TO service_role;

-- ---------------------------------------------------------------------
-- 5. Vue d'audit des abonnements orphelins
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.subscription_integrity_report
WITH (security_invoker = on)
AS
SELECT
  s.id                            AS subscription_id,
  s.customer_id,
  s.plan_name,
  s.plan_price,
  s.frozen_name,
  s.frozen_unit_price,
  s.source_order_item_id,
  oi.is_recurring                 AS source_item_is_recurring,
  CASE
    WHEN s.source_order_item_id IS NULL             THEN 'missing_source_order_item'
    WHEN oi.id IS NULL                              THEN 'source_order_item_deleted'
    WHEN oi.is_recurring IS DISTINCT FROM true      THEN 'source_item_not_recurring'
    WHEN s.frozen_name IS NULL
      OR s.frozen_unit_price IS NULL                THEN 'missing_frozen_data'
    ELSE 'ok'
  END AS integrity_status
FROM public.billing_subscriptions s
LEFT JOIN public.order_items oi ON oi.id = s.source_order_item_id;

GRANT SELECT ON public.subscription_integrity_report TO authenticated;
GRANT SELECT ON public.subscription_integrity_report TO service_role;

-- ---------------------------------------------------------------------
-- 6. Commentaires (documentation en base)
-- ---------------------------------------------------------------------
COMMENT ON COLUMN public.billing_invoice_lines.source_ref IS
  'Origine canonique de la ligne. Une ligne ne peut pas exister sans une source réelle. Valeurs : order_item | manual_admin | credit_application | payment_application | tax | promotion_applied | system_migration.';
COMMENT ON COLUMN public.billing_invoice_lines.line_kind IS
  'Nature de la ligne. Une ligne ne peut avoir un montant négatif que si line_kind ∈ (promotion, discount, credit_application, payment_application).';
COMMENT ON COLUMN public.billing_subscriptions.source_order_item_id IS
  'Ligne de commande d''origine. Un abonnement ne peut exister sans cette référence, et cet order_item DOIT avoir is_recurring = true.';
COMMENT ON COLUMN public.billing_subscriptions.frozen_unit_price IS
  'Prix vendu au moment de la création. Immuable. Un changement de forfait crée un nouvel abonnement via superseded_by_subscription_id.';
