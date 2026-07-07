
-- ============================================================================
-- Phase 3.B.2 partie 1 : Gel technique PayPal
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Table de log des tentatives Square (sans effet de bord)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.square_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NULL,
  subscription_id UUID NULL,
  customer_id UUID NULL,
  amount NUMERIC(12,2) NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  idempotency_key TEXT NOT NULL,
  square_payment_id TEXT NULL,
  square_error_code TEXT NULL,
  square_error_category TEXT NULL,
  square_error_detail TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','pending','duplicate')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  response_raw JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sqa_invoice ON public.square_payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sqa_subscription ON public.square_payment_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sqa_status_created ON public.square_payment_attempts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sqa_square_payment_id ON public.square_payment_attempts(square_payment_id) WHERE square_payment_id IS NOT NULL;

GRANT SELECT ON public.square_payment_attempts TO authenticated;
GRANT ALL ON public.square_payment_attempts TO service_role;

ALTER TABLE public.square_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read square attempts"
ON public.square_payment_attempts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing_admin')
  OR public.has_role(auth.uid(), 'supervisor')
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Inventaire des fonctions Edge dépréciées
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deprecated_edge_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('disabled','readonly','stub_410','deprecated')),
  reason TEXT NOT NULL,
  deprecated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replaced_by TEXT NULL,
  notes JSONB NULL
);

GRANT SELECT ON public.deprecated_edge_functions TO authenticated;
GRANT ALL ON public.deprecated_edge_functions TO service_role;

ALTER TABLE public.deprecated_edge_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deprecated functions"
ON public.deprecated_edge_functions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing_admin')
);

-- Inventaire initial : toutes les Edge Functions PayPal existantes
INSERT INTO public.deprecated_edge_functions (function_name, status, reason, replaced_by) VALUES
  ('paypal-webhook',                              'readonly',  'PayPal gelé — webhook conservé lecture seule pour audit/logs uniquement', 'square-webhook'),
  ('paypal-capture-order',                        'stub_410',  'PayPal gelé — capture désactivée',                                        'square-charge-invoice'),
  ('paypal-charge-subscription',                  'stub_410',  'PayPal gelé — charge récurrente désactivée',                              'square-charge-subscription'),
  ('paypal-balance-pay-capture',                  'stub_410',  'PayPal gelé — paiement de solde désactivé',                               'square-charge-invoice'),
  ('paypal-balance-pay-create',                   'stub_410',  'PayPal gelé — création ordre solde désactivée',                           NULL),
  ('paypal-create-order',                         'stub_410',  'PayPal gelé — création ordre désactivée',                                 NULL),
  ('paypal-create-subscription',                  'stub_410',  'PayPal gelé — création abonnement désactivée',                            NULL),
  ('paypal-cancel-subscription',                  'readonly',  'PayPal gelé — annulation locale seulement, aucun appel PayPal',           NULL),
  ('paypal-refund',                               'stub_410',  'PayPal gelé — remboursements manuels via Square uniquement',              NULL),
  ('paypal-sync-subscription-state',              'stub_410',  'PayPal gelé — sync état abonnement désactivée',                           NULL),
  ('paypal-verify-subscription',                  'readonly',  'PayPal gelé — vérification lecture seule',                                NULL),
  ('paypal-reconcile',                            'readonly',  'PayPal gelé — réconciliation lecture seule',                              NULL),
  ('paypal-client-token',                         'stub_410',  'PayPal gelé — token client désactivé',                                    NULL),
  ('billing-paypal-retry-failed',                 'stub_410',  'PayPal gelé — retry désactivé',                                           'square-autopay-retry'),
  ('billing-create-order-with-paypal-subscription','stub_410', 'PayPal gelé — création commande + abonnement PayPal désactivée',          'billing-create-order'),
  ('core-paypal-order-link',                      'stub_410',  'PayPal gelé — génération lien de paiement désactivée',                    'core-square-payment-link')
ON CONFLICT (function_name) DO UPDATE
  SET status = EXCLUDED.status,
      reason = EXCLUDED.reason,
      replaced_by = EXCLUDED.replaced_by,
      deprecated_at = now();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Fonction utilitaire : détection d'un chemin PayPal
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._is_paypal_context(_provider TEXT, _rpc_used TEXT, _payment_kind TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    (_payment_kind IS DISTINCT FROM 'legacy_readonly')
    AND (
      lower(coalesce(_provider, '')) = 'paypal'
      OR lower(coalesce(_rpc_used, '')) LIKE '%paypal%'
    )
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Trigger : billing_payments — refus INSERT/UPDATE PayPal
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_billing_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_paypal_context(NEW.provider, NEW.rpc_used, NEW.payment_kind) THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: PayPal est gelé. Aucun billing_payment ne peut être créé/modifié via PayPal. provider=% rpc_used=% payment_kind=%',
      NEW.provider, NEW.rpc_used, NEW.payment_kind
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_billing_payment ON public.billing_payments;
CREATE TRIGGER trg_forbid_paypal_billing_payment
  BEFORE INSERT OR UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_billing_payment();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trigger : billing_invoices — refus UPDATE via chemin PayPal
--    Détecté via GUC app.current_provider ou colonne payment_provider
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_invoice_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Mise à jour billing_invoices interdite via chemin PayPal (app.current_provider=paypal)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_invoice_write ON public.billing_invoices;
CREATE TRIGGER trg_forbid_paypal_invoice_write
  BEFORE INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_invoice_write();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Trigger : billing_invoice_lines — refus INSERT via chemin PayPal
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_invoice_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Insertion billing_invoice_lines interdite via chemin PayPal'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_invoice_line ON public.billing_invoice_lines;
CREATE TRIGGER trg_forbid_paypal_invoice_line
  BEFORE INSERT OR UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_invoice_line();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Trigger : billing_subscriptions — refus écriture identifiants PayPal
--    Autorise UPDATE si les colonnes PayPal ne changent PAS (historique intact).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_subscription_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);

  IF TG_OP = 'INSERT' THEN
    IF NEW.paypal_subscription_id IS NOT NULL OR NEW.paypal_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Création billing_subscriptions avec identifiants PayPal interdite'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
      RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Création billing_subscriptions via chemin PayPal interdite'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Refuser la modification des identifiants PayPal existants (sauf mise à NULL par admin)
    IF NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id
       AND NEW.paypal_subscription_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Modification paypal_subscription_id interdite (historique lecture seule)'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id
       AND NEW.paypal_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Modification paypal_plan_id interdite (historique lecture seule)'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
      RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Modification billing_subscriptions via chemin PayPal interdite'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_subscription_write ON public.billing_subscriptions;
CREATE TRIGGER trg_forbid_paypal_subscription_write
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_subscription_write();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Trigger : account_adjustments — refus si source PayPal
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Création account_adjustments via chemin PayPal interdite'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Interdire toute mention textuelle de PayPal dans la source/raison
  IF lower(coalesce(NEW.source, '')) LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: account_adjustments avec source PayPal interdit (source=%)', NEW.source
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_adjustment ON public.account_adjustments;
CREATE TRIGGER trg_forbid_paypal_adjustment
  BEFORE INSERT OR UPDATE ON public.account_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_adjustment();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Trigger : account_promotions — refus si source PayPal
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_forbid_paypal_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx TEXT;
BEGIN
  v_ctx := current_setting('app.current_provider', true);
  IF v_ctx IS NOT NULL AND lower(v_ctx) = 'paypal' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: Création account_promotions via chemin PayPal interdite'
      USING ERRCODE = 'check_violation';
  END IF;
  IF lower(coalesce(NEW.source, '')) LIKE '%paypal%' THEN
    RAISE EXCEPTION 'INVARIANT-3B2-PAYPAL-FROZEN: account_promotions avec source PayPal interdit (source=%)', NEW.source
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_paypal_promotion ON public.account_promotions;
CREATE TRIGGER trg_forbid_paypal_promotion
  BEFORE INSERT OR UPDATE ON public.account_promotions
  FOR EACH ROW EXECUTE FUNCTION public.fn_forbid_paypal_promotion();

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Renforcement apply_payment_to_invoice : provider whitelist
--     On enveloppe la RPC existante avec un guard PayPal.
--     La RPC canonique est déjà appelée par les webhooks — on ajoute juste
--     un CHECK explicite au début.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_payment_to_invoice'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'apply_payment_to_invoice absent — guard PayPal non appliqué (à revoir).';
  END IF;
END $$;

-- Guard indirect via billing_payments (trigger #4) : toute tentative
-- apply_payment_to_invoice(provider='paypal', ...) échouera à l'INSERT dans
-- billing_payments. Aucun code applicatif n'a besoin d'être modifié.

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Contrainte anti-crédit-refund-PayPal (idempotent)
--     Bloque la création d'un billing_payment de type refund via PayPal.
-- ─────────────────────────────────────────────────────────────────────────
-- Déjà couvert par le trigger #4 (fn_forbid_paypal_billing_payment) qui
-- inspecte provider indépendamment du payment_kind (sauf legacy_readonly).

-- ─────────────────────────────────────────────────────────────────────────
-- 12. Log de l'application du gel
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.activity_logs (entity_type, entity_id, action, details, actor_name, actor_role)
VALUES (
  'system',
  NULL,
  'paypal_frozen_3b2_part1',
  jsonb_build_object(
    'phase', '3.B.2 partie 1',
    'triggers_installed', jsonb_build_array(
      'trg_forbid_paypal_billing_payment',
      'trg_forbid_paypal_invoice_write',
      'trg_forbid_paypal_invoice_line',
      'trg_forbid_paypal_subscription_write',
      'trg_forbid_paypal_adjustment',
      'trg_forbid_paypal_promotion'
    ),
    'tables_created', jsonb_build_array('square_payment_attempts', 'deprecated_edge_functions'),
    'edge_functions_deprecated', 16,
    'active_processor', 'square',
    'legacy_processor', 'paypal (readonly)'
  ),
  'system',
  'system'
);
