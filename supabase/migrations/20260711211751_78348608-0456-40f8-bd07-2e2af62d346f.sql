-- Module 49 Phase A — Fondations DB (client-account-actions gateway)

-- 1) New columns on accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_same_as_service boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_service_address_id uuid NULL
    REFERENCES public.service_addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_billing_service_address_id
  ON public.accounts(billing_service_address_id);

-- 2) Backfill billing_same_as_service on existing rows
--    Rule: NULL billing_address -> true, otherwise false
UPDATE public.accounts
SET billing_same_as_service = (billing_address IS NULL);

-- 3) Idempotency table for future gateway
CREATE TABLE IF NOT EXISTS public.client_account_action_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  action text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NULL,
  actor_id uuid NULL,
  result jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_account_action_idempotency_unique UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_caai_account_action
  ON public.client_account_action_idempotency(account_id, action);
CREATE INDEX IF NOT EXISTS idx_caai_created_at
  ON public.client_account_action_idempotency(created_at DESC);

-- GRANTs: gateway-only (service_role). No anon / authenticated access.
GRANT ALL ON public.client_account_action_idempotency TO service_role;

ALTER TABLE public.client_account_action_idempotency ENABLE ROW LEVEL SECURITY;

-- No policy for anon/authenticated: writes/reads happen exclusively via service_role EF.
CREATE POLICY "service_role full access - client_account_action_idempotency"
  ON public.client_account_action_idempotency
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4) Deprecation comments on legacy columns (no behavior change)
COMMENT ON COLUMN public.accounts.primary_service_address IS
  'DEPRECATED (Module 49): use service_addresses (canonical 1:N). Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.primary_service_city IS
  'DEPRECATED (Module 49): use service_addresses. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.primary_service_province IS
  'DEPRECATED (Module 49): use service_addresses. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.primary_service_postal_code IS
  'DEPRECATED (Module 49): use service_addresses. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.billing_address IS
  'DEPRECATED (Module 49): use billing_same_as_service + billing_service_address_id. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.billing_city IS
  'DEPRECATED (Module 49): use billing_same_as_service + billing_service_address_id. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.billing_province IS
  'DEPRECATED (Module 49): use billing_same_as_service + billing_service_address_id. Kept for progressive migration.';
COMMENT ON COLUMN public.accounts.billing_postal_code IS
  'DEPRECATED (Module 49): use billing_same_as_service + billing_service_address_id. Kept for progressive migration.';

COMMENT ON COLUMN public.accounts.billing_same_as_service IS
  'Module 49: true if billing address mirrors the service address (default).';
COMMENT ON COLUMN public.accounts.billing_service_address_id IS
  'Module 49: FK to service_addresses used specifically for billing when billing_same_as_service = false.';
COMMENT ON TABLE public.client_account_action_idempotency IS
  'Module 49: idempotency ledger for the future client-account-actions gateway (profile/addresses/billing writes).';
