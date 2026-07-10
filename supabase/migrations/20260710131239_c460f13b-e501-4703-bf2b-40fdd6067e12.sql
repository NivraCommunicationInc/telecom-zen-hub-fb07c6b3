
-- ============================================================
-- MODULE 33 — PARRAINAGES — PHASE A (P0 sécurité financière)
-- F33-1, F33-3, F33-4, F33-5, F33-14 (P0), F33-15, F33-19
-- ============================================================

-- ---- F33-3 — Bloquer INSERT/UPDATE/DELETE direct sur referral_attributions ----
-- Les policies existantes autorisent 'admin' via authenticated. On coupe l'accès
-- au niveau des privilèges: seules les Edge Functions (service_role) écrivent.
REVOKE INSERT, UPDATE, DELETE ON public.referral_attributions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.referral_attributions FROM anon;
GRANT SELECT ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;

-- Idem pour client_referrals (writes via referrals-account-actions uniquement)
REVOKE INSERT, UPDATE, DELETE ON public.client_referrals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_referrals FROM anon;
GRANT SELECT ON public.client_referrals TO authenticated;
GRANT ALL ON public.client_referrals TO service_role;

-- Idem pour client_referral_events (audit trail)
REVOKE INSERT, UPDATE, DELETE ON public.client_referral_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_referral_events FROM anon;
GRANT SELECT ON public.client_referral_events TO authenticated;
GRANT ALL ON public.client_referral_events TO service_role;

-- ---- F33-14 (P0) — Anti double commission ----
-- Une seule ligne (attribution_id, type) dans commission_ledger_entries.
-- Le cycle pending → approved → reversed → approved doit updater la ligne
-- existante, jamais créer un doublon.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_ledger_attribution_type
  ON public.commission_ledger_entries (attribution_id, type)
  WHERE attribution_id IS NOT NULL;

-- ---- F33-5 — Idempotence retries checkout ----
-- Un seul client_referrals par referred_order_id (protège les retries Square).
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_referrals_referred_order
  ON public.client_referrals (referred_order_id)
  WHERE referred_order_id IS NOT NULL;

-- Un seul referral_attributions par order_id (idempotence checkout guest).
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_attributions_order
  ON public.referral_attributions (order_id)
  WHERE order_id IS NOT NULL;

-- ---- F33-15 — Standardiser client_referral_events ----
-- La table est vide (0 rows), on peut ajouter le CHECK sans backfill.
ALTER TABLE public.client_referral_events
  DROP CONSTRAINT IF EXISTS client_referral_events_event_type_chk;
ALTER TABLE public.client_referral_events
  ADD CONSTRAINT client_referral_events_event_type_chk
  CHECK (event_type IN (
    'created', 'code_used', 'attached_to_order',
    'cycle_paid', 'qualified', 'disqualified',
    'reward_pending', 'reward_issued', 'reward_sent', 'reward_delivered',
    'fraud_flagged', 'fraud_cleared',
    'reassigned', 'clawback',
    'discount_applied', 'discount_month_decremented',
    'note_added'
  ));

-- ---- F33-4 — Projection publique restreinte de referral_program_settings ----
-- Ne jamais exposer commission_value_default, payout_delay, allow_self_referrals.
DROP POLICY IF EXISTS "Anyone can read program settings" ON public.referral_program_settings;

-- Vue publique limitée (SELECT uniquement — pas de tokens internes anti-fraude).
DROP VIEW IF EXISTS public.v_referral_program_public;
CREATE VIEW public.v_referral_program_public
WITH (security_invoker = on)
AS
SELECT
  discount_percent_first_invoice_monthly,
  discount_stacks,
  required_cycles,
  cooldown_days,
  min_cashout_amount
FROM public.referral_program_settings
LIMIT 1;

GRANT SELECT ON public.v_referral_program_public TO anon, authenticated;

-- Le staff garde SELECT complet via has_role (policies existantes).

-- ---- F33-19 — Audit modifications referral_program_settings ----
CREATE TABLE IF NOT EXISTS public.referral_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_row jsonb,
  new_row jsonb,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE'))
);
GRANT SELECT ON public.referral_settings_audit TO authenticated;
GRANT ALL ON public.referral_settings_audit TO service_role;
ALTER TABLE public.referral_settings_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_view_referral_settings_audit" ON public.referral_settings_audit;
CREATE POLICY "admins_view_referral_settings_audit"
  ON public.referral_settings_audit FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.fn_audit_referral_program_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.referral_settings_audit(changed_by, operation, old_row, new_row)
  VALUES (
    auth.uid(),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_referral_program_settings ON public.referral_program_settings;
CREATE TRIGGER trg_audit_referral_program_settings
AFTER INSERT OR UPDATE OR DELETE ON public.referral_program_settings
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_referral_program_settings();

-- ---- F33-1 — RPC canonique de write avec row lock + audit + reason ----
-- Utilisé par referrals-account-actions et admin_referral_* pour toute
-- mutation sur client_referrals. Idempotent via event_key optionnel.
CREATE OR REPLACE FUNCTION public.rpc_referral_apply_action(
  p_referral_id uuid,
  p_action text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_event_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.client_referrals%ROWTYPE;
  v_now timestamptz := now();
  v_settings public.referral_program_settings%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_referral_id IS NULL THEN
    RAISE EXCEPTION 'p_action et p_referral_id requis';
  END IF;

  -- Actions exigeant une raison
  IF p_action IN ('mark_fraud','disqualify','clawback','reassign')
     AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'reason requis pour action %', p_action;
  END IF;

  -- Idempotence: si un event_key existe déjà, no-op
  IF p_event_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.client_referral_events
      WHERE referral_id = p_referral_id
        AND details ? 'event_key'
        AND details->>'event_key' = p_event_key
    ) THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;
  END IF;

  -- Row lock
  SELECT * INTO v_ref FROM public.client_referrals
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parrainage introuvable';
  END IF;

  SELECT * INTO v_settings FROM public.referral_program_settings LIMIT 1;

  -- Log de l'événement
  INSERT INTO public.client_referral_events(
    referral_id, event_type, old_status, new_status, details, actor_id, actor_type
  ) VALUES (
    p_referral_id,
    CASE p_action
      WHEN 'qualify' THEN 'qualified'
      WHEN 'issue_reward' THEN 'reward_issued'
      WHEN 'mark_delivered' THEN 'reward_delivered'
      WHEN 'mark_fraud' THEN 'fraud_flagged'
      WHEN 'clear_fraud' THEN 'fraud_cleared'
      WHEN 'disqualify' THEN 'disqualified'
      WHEN 'clawback' THEN 'clawback'
      WHEN 'reassign' THEN 'reassigned'
      ELSE 'note_added'
    END,
    v_ref.status::text,
    NULL,
    jsonb_build_object('reason', p_reason, 'event_key', p_event_key, 'payload', p_payload),
    p_actor_id,
    'staff'
  );

  RETURN jsonb_build_object('ok', true, 'referral', to_jsonb(v_ref));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_referral_apply_action(uuid, text, uuid, text, jsonb, text)
  TO service_role;

-- ---- F33-6 preparation — décommissionner fn_track_referral_payment ----
-- Marque la fonction comme dépréciée (le trigger sera nettoyé en Phase B).
COMMENT ON FUNCTION public.fn_track_referral_payment() IS
  'DEPRECATED (F33-6, Phase A/B): utiliser fn_referral_on_invoice_paid comme source unique. Ne plus attacher à un nouveau trigger.';
