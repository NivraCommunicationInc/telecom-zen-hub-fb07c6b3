-- ==============================================================================
-- BILLING STATE ENGINE — Source unique de vérité pour le statut d'un compte
-- ==============================================================================
-- Problème résolu:
--   Avant cette migration, le "statut" d'un compte était dispersé dans:
--     - accounts.status                 ('active' | 'suspended' | 'closed')
--     - billing_subscriptions.status    (6 valeurs possibles)
--     - billing_invoices.status         (11 valeurs)
--     - kyc_verifications.status        ('pending' | 'approved' | ...)
--     - recurring_setup_status          (sur subscription)
--
--   Chaque portail (Core, Field, Employee, Tech, Client) combinait ces signaux
--   différemment. Résultat: un client pouvait être "active" dans un portail et
--   "suspended" dans un autre — bugs cross-portail #1 dans l'audit.
--
-- Solution:
--   1. Fonction `get_account_state(account_id)` qui retourne UN état canonique
--   2. Vue `v_account_state` pour les lectures fréquentes
--   3. Tous les portails liront `v_account_state` au lieu de combiner manuellement
--
-- Les états canoniques (priorité décroissante — premier match gagne):
--   - closed                  → compte fermé définitivement (terminal)
--   - cancelled               → tous les abonnements annulés (récupérable)
--   - suspended_non_payment   → suspendu pour non-paiement (récupérable)
--   - pending_payment         → facture impayée en cours
--   - pending_kyc             → vérification d'identité non complétée
--   - pending_activation      → KYC + paiement OK, service pas encore activé
--   - active                  → tout est bon
--   - new                     → compte créé mais aucun abonnement (avant 1er checkout)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_account_state(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account            record;
  v_client_id          uuid;
  v_active_subs        int := 0;
  v_pending_subs       int := 0;
  v_suspended_subs     int := 0;
  v_cancelled_subs     int := 0;
  v_total_subs         int := 0;
  v_overdue_invoices   int := 0;
  v_pending_invoices   int := 0;
  v_kyc_status         text;
  v_kyc_pending_count  int := 0;
  v_state              text;
  v_label_fr           text;
  v_label_en           text;
  v_color              text;       -- 'green' | 'amber' | 'red' | 'blue' | 'gray'
  v_reason             text;
  v_issues             jsonb := '[]'::jsonb;
  v_last_updated       timestamptz;
  v_has_active_install boolean := false;
BEGIN
  -- Load the account.
  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'account_id', p_account_id,
      'state', 'not_found',
      'label_fr', 'Compte introuvable',
      'label_en', 'Account not found',
      'color', 'gray',
      'reason', 'No account row for the given id',
      'blocking_issues', jsonb_build_array('account_missing'),
      'computed_at', now()
    );
  END IF;

  v_client_id := v_account.client_id;
  v_last_updated := v_account.updated_at;

  -- Aggregate subscriptions linked to this account's client.
  -- billing_subscriptions are owned by billing_customers, which are linked to
  -- auth.users via user_id. accounts.client_id = profiles.user_id = billing_customers.user_id.
  SELECT
    COUNT(*) FILTER (WHERE bs.status = 'active'),
    COUNT(*) FILTER (WHERE bs.status = 'pending'),
    COUNT(*) FILTER (WHERE bs.status = 'suspended'),
    COUNT(*) FILTER (WHERE bs.status IN ('cancelled', 'expired', 'not_renewed')),
    COUNT(*),
    MAX(GREATEST(COALESCE(bs.updated_at, bs.created_at), v_last_updated))
  INTO v_active_subs, v_pending_subs, v_suspended_subs, v_cancelled_subs, v_total_subs, v_last_updated
  FROM public.billing_subscriptions bs
  JOIN public.billing_customers bc ON bc.id = bs.customer_id
  WHERE bc.user_id = v_client_id;

  -- Aggregate invoices.
  SELECT
    COUNT(*) FILTER (WHERE bi.status = 'overdue'),
    COUNT(*) FILTER (WHERE bi.status IN ('pending', 'partially_paid'))
  INTO v_overdue_invoices, v_pending_invoices
  FROM public.billing_invoices bi
  JOIN public.billing_customers bc ON bc.id = bi.customer_id
  WHERE bc.user_id = v_client_id;

  -- Latest KYC state for this account (most recent verification).
  SELECT kv.status, COUNT(*) FILTER (WHERE kv.status = 'pending')
  INTO v_kyc_status, v_kyc_pending_count
  FROM public.kyc_verifications kv
  WHERE kv.account_id = p_account_id
  GROUP BY kv.status
  ORDER BY MAX(kv.created_at) DESC
  LIMIT 1;

  -- Has a completed installation? (Used to distinguish pending_activation vs active.)
  -- We treat ANY completed installation across the account's subs as enough.
  SELECT EXISTS (
    SELECT 1
    FROM public.installations i
    WHERE i.account_id = p_account_id
      AND i.status IN ('completed', 'verified')
  ) INTO v_has_active_install;

  -- ────────────────────────────────────────────────────────────────────
  -- DECISION TREE — priority order, first match wins.
  -- ────────────────────────────────────────────────────────────────────

  IF v_account.status = 'closed' THEN
    v_state := 'closed';
    v_label_fr := 'Compte fermé';
    v_label_en := 'Account closed';
    v_color := 'gray';
    v_reason := 'accounts.status = closed';

  ELSIF v_total_subs > 0 AND v_active_subs = 0 AND v_pending_subs = 0 AND v_suspended_subs = 0 THEN
    -- All historical subs are cancelled/expired/not_renewed and nothing active.
    v_state := 'cancelled';
    v_label_fr := 'Abonnement annulé';
    v_label_en := 'Subscription cancelled';
    v_color := 'gray';
    v_reason := format('All %s subscription(s) are terminal (cancelled/expired/not_renewed)', v_cancelled_subs);
    v_issues := v_issues || jsonb_build_array('no_active_subscription');

  ELSIF v_account.status = 'suspended' OR v_suspended_subs > 0 THEN
    v_state := 'suspended_non_payment';
    v_label_fr := 'Service suspendu';
    v_label_en := 'Service suspended';
    v_color := 'red';
    IF v_overdue_invoices > 0 THEN
      v_reason := format('%s overdue invoice(s) — payment required to restore service', v_overdue_invoices);
      v_issues := v_issues || jsonb_build_array('overdue_invoice', 'payment_required');
    ELSE
      v_reason := 'Subscription marked suspended (no overdue invoice detected — admin action?)';
      v_issues := v_issues || jsonb_build_array('suspended_no_overdue');
    END IF;

  ELSIF v_overdue_invoices > 0 THEN
    -- Account technically still active but has overdue — grace period.
    v_state := 'pending_payment';
    v_label_fr := 'Paiement en attente';
    v_label_en := 'Payment pending';
    v_color := 'amber';
    v_reason := format('%s overdue invoice(s) within grace period', v_overdue_invoices);
    v_issues := v_issues || jsonb_build_array('overdue_invoice');

  ELSIF v_pending_invoices > 0 AND v_active_subs = 0 THEN
    -- Has a pending invoice but no active subscription → first-cycle payment expected.
    v_state := 'pending_payment';
    v_label_fr := 'Paiement initial requis';
    v_label_en := 'Initial payment required';
    v_color := 'amber';
    v_reason := format('%s pending invoice(s), no active subscription yet', v_pending_invoices);
    v_issues := v_issues || jsonb_build_array('first_payment_pending');

  ELSIF v_kyc_status = 'pending' OR v_kyc_pending_count > 0 THEN
    v_state := 'pending_kyc';
    v_label_fr := 'Vérification d''identité requise';
    v_label_en := 'Identity verification required';
    v_color := 'blue';
    v_reason := 'KYC verification still pending';
    v_issues := v_issues || jsonb_build_array('kyc_pending');

  ELSIF v_active_subs > 0 AND NOT v_has_active_install THEN
    v_state := 'pending_activation';
    v_label_fr := 'En attente d''activation';
    v_label_en := 'Pending activation';
    v_color := 'blue';
    v_reason := 'Subscription active but no completed installation on file';
    v_issues := v_issues || jsonb_build_array('installation_pending');

  ELSIF v_active_subs > 0 THEN
    v_state := 'active';
    v_label_fr := 'Service actif';
    v_label_en := 'Service active';
    v_color := 'green';
    v_reason := format('%s active subscription(s), no blocking issues', v_active_subs);

  ELSIF v_pending_subs > 0 THEN
    v_state := 'pending_payment';
    v_label_fr := 'Paiement initial requis';
    v_label_en := 'Initial payment required';
    v_color := 'amber';
    v_reason := format('%s subscription(s) pending first payment', v_pending_subs);
    v_issues := v_issues || jsonb_build_array('first_payment_pending');

  ELSE
    -- Account exists but no subscriptions at all → freshly created
    v_state := 'new';
    v_label_fr := 'Nouveau compte';
    v_label_en := 'New account';
    v_color := 'gray';
    v_reason := 'Account created, no subscription yet';
  END IF;

  RETURN jsonb_build_object(
    'account_id', p_account_id,
    'client_id', v_client_id,
    'state', v_state,
    'label_fr', v_label_fr,
    'label_en', v_label_en,
    'color', v_color,
    'reason', v_reason,
    'blocking_issues', v_issues,
    'signals', jsonb_build_object(
      'account_status', v_account.status,
      'active_subscriptions', v_active_subs,
      'pending_subscriptions', v_pending_subs,
      'suspended_subscriptions', v_suspended_subs,
      'cancelled_subscriptions', v_cancelled_subs,
      'total_subscriptions', v_total_subs,
      'overdue_invoices', v_overdue_invoices,
      'pending_invoices', v_pending_invoices,
      'kyc_status', v_kyc_status,
      'has_completed_install', v_has_active_install
    ),
    'last_updated_at', v_last_updated,
    'computed_at', now()
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS
-- ──────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_account_state(uuid) TO authenticated, service_role;

-- Convenience view: one row per account with the canonical state inline.
-- Use this for list pages (e.g. CSR client list) to avoid N+1 RPC calls.
CREATE OR REPLACE VIEW public.v_account_state
WITH (security_invoker = on)
AS
SELECT
  a.id AS account_id,
  a.client_id,
  a.account_number,
  (s ->> 'state')                  AS state,
  (s ->> 'label_fr')               AS label_fr,
  (s ->> 'label_en')               AS label_en,
  (s ->> 'color')                  AS color,
  (s ->> 'reason')                 AS reason,
  (s -> 'blocking_issues')         AS blocking_issues,
  (s -> 'signals')                 AS signals,
  (s ->> 'last_updated_at')::timestamptz AS last_updated_at,
  (s ->> 'computed_at')::timestamptz     AS computed_at
FROM public.accounts a
CROSS JOIN LATERAL public.get_account_state(a.id) AS s;

GRANT SELECT ON public.v_account_state TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- AUDIT — record this migration in security_events for traceability.
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'BILLING_STATE_ENGINE_INSTALLED',
  'info',
  jsonb_build_object(
    'description', 'Canonical account state engine — get_account_state() + v_account_state',
    'states', ARRAY[
      'new', 'pending_kyc', 'pending_payment', 'pending_activation',
      'active', 'suspended_non_payment', 'cancelled', 'closed', 'not_found'
    ],
    'applied_at', now()
  )
);
