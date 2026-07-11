
-- Module 43 Phase 2 — Fraud / Risk hardening
-- 1) Idempotency table for fraud-risk-actions
CREATE TABLE IF NOT EXISTS public.fraud_action_idempotency (
  idempotency_key uuid PRIMARY KEY,
  action text NOT NULL,
  actor_id uuid,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

GRANT ALL ON public.fraud_action_idempotency TO service_role;

ALTER TABLE public.fraud_action_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role manages fraud idempotency" ON public.fraud_action_idempotency;
CREATE POLICY "service_role manages fraud idempotency"
  ON public.fraud_action_idempotency
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_fraud_action_idempotency_expires
  ON public.fraud_action_idempotency (expires_at);

-- 2) Defensive RLS on account_fraud_incidents:
--    keep SELECT for staff, remove broad INSERT/UPDATE; writes go through
--    Edge Function under service_role (Module 43 canonical gateway).
DROP POLICY IF EXISTS "Staff can insert fraud incidents" ON public.account_fraud_incidents;
DROP POLICY IF EXISTS "Staff can update fraud incidents" ON public.account_fraud_incidents;

-- 3) Defensive RLS on account_risk_scores:
DROP POLICY IF EXISTS "Staff can upsert risk scores" ON public.account_risk_scores;
DROP POLICY IF EXISTS "Staff can update risk scores" ON public.account_risk_scores;
