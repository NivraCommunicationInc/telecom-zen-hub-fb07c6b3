
-- =============================================================================
-- Module 34 — Bon de compensation : Hardening (F34-1 → F34-22)
-- =============================================================================
-- Strategy: NO parallel 'compensation' type. Map to existing 'credit' engine.
-- Add metadata, idempotency, expiration state machine, server-side amount RPC.
-- =============================================================================

-- 1. Metadata + idempotency + expanded status ----------------------------------
ALTER TABLE public.account_adjustments
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

-- Expand status enum: active | completed | cancelled | expired | revoked
ALTER TABLE public.account_adjustments DROP CONSTRAINT IF EXISTS account_adjustments_status_check;
ALTER TABLE public.account_adjustments ADD CONSTRAINT account_adjustments_status_check
  CHECK (status = ANY (ARRAY['active','completed','cancelled','expired','revoked']::text[]));

-- Unique idempotency per account (partial index — null keys allowed for legacy)
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_adjustments_idempotency
  ON public.account_adjustments(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for cron expiration sweep
CREATE INDEX IF NOT EXISTS idx_account_adjustments_expires_at
  ON public.account_adjustments(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- 2. RPC: server-side monthly value (F34-3) ------------------------------------
CREATE OR REPLACE FUNCTION public.compute_month_free_value(_account_id UUID)
RETURNS TABLE(monthly_amount NUMERIC, source TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id UUID;
  _sum NUMERIC;
BEGIN
  SELECT client_id INTO _client_id FROM public.accounts WHERE id = _account_id;
  IF _client_id IS NULL THEN
    monthly_amount := 30; source := 'fallback_no_account'; RETURN NEXT; RETURN;
  END IF;

  SELECT COALESCE(SUM(bs.plan_price), 0) INTO _sum
  FROM public.billing_subscriptions bs
  JOIN public.billing_customers bc ON bc.id = bs.customer_id
  WHERE bc.user_id = _client_id
    AND bs.status = 'active';

  IF _sum > 0 THEN
    monthly_amount := _sum; source := 'active_subscriptions'; RETURN NEXT; RETURN;
  END IF;

  -- Fallback: minimum floor to prevent 0$ vouchers
  monthly_amount := 30; source := 'fallback_minimum'; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_month_free_value(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_month_free_value(UUID) TO authenticated, service_role;

-- 3. RPC: state transition (F34-8) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.compensation_transition(
  _adjustment_id UUID,
  _new_status TEXT,
  _actor_id UUID,
  _reason TEXT
) RETURNS public.account_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.account_adjustments;
BEGIN
  SELECT * INTO _row FROM public.account_adjustments
    WHERE id = _adjustment_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'adjustment_not_found'; END IF;

  IF (_row.metadata->>'compensation') IS NULL THEN
    RAISE EXCEPTION 'not_a_compensation_voucher';
  END IF;

  -- Valid transitions
  IF _row.status = 'active' AND _new_status NOT IN ('completed','expired','revoked','cancelled') THEN
    RAISE EXCEPTION 'invalid_transition_from_active_to_%', _new_status;
  END IF;
  IF _row.status IN ('completed','expired','revoked','cancelled') THEN
    RAISE EXCEPTION 'terminal_state_%', _row.status;
  END IF;

  UPDATE public.account_adjustments SET
    status = _new_status,
    revoked_at = CASE WHEN _new_status = 'revoked' THEN now() ELSE revoked_at END,
    revoked_by = CASE WHEN _new_status = 'revoked' THEN _actor_id ELSE revoked_by END,
    revoke_reason = CASE WHEN _new_status IN ('revoked','cancelled','expired') THEN COALESCE(_reason, revoke_reason) ELSE revoke_reason END
  WHERE id = _adjustment_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.compensation_transition(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compensation_transition(UUID, TEXT, UUID, TEXT) TO service_role;

-- 4. Trigger: block direct compensation writes from non-service_role (F34-1) ---
CREATE OR REPLACE FUNCTION public.guard_compensation_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for rows tagged as compensation
  IF TG_OP = 'INSERT' AND (NEW.metadata ? 'compensation') THEN
    IF current_setting('request.jwt.claim.role', true) NOT IN ('service_role') THEN
      -- Allow if actor is service role via edge function; block anon/authenticated direct writes
      IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'compensation_direct_write_forbidden: use core-issue-compensation edge function';
      END IF;
    END IF;
    -- Idempotency key mandatory for compensation
    IF NEW.idempotency_key IS NULL THEN
      RAISE EXCEPTION 'compensation_idempotency_key_required';
    END IF;
    -- Expiration mandatory for compensation (F34-7)
    IF NEW.expires_at IS NULL THEN
      RAISE EXCEPTION 'compensation_expires_at_required';
    END IF;
    -- Category required (F34-16)
    IF (NEW.metadata->'compensation'->>'category') IS NULL THEN
      RAISE EXCEPTION 'compensation_category_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_compensation_writes ON public.account_adjustments;
CREATE TRIGGER trg_guard_compensation_writes
  BEFORE INSERT ON public.account_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.guard_compensation_writes();

-- 5. Cron: automatic expiration (F34-7) ----------------------------------------
CREATE OR REPLACE FUNCTION public.cron_expire_compensations()
RETURNS TABLE(expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n INT;
BEGIN
  WITH upd AS (
    UPDATE public.account_adjustments
    SET status = 'expired',
        revoke_reason = COALESCE(revoke_reason, 'auto_expired_by_cron')
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
      AND (metadata ? 'compensation')
    RETURNING id
  )
  SELECT COUNT(*) INTO _n FROM upd;
  expired_count := _n; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_expire_compensations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_expire_compensations() TO service_role;
