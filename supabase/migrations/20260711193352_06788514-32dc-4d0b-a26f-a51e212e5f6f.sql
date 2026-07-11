
-- Enum: transfer status
DO $$ BEGIN
  CREATE TYPE public.account_transfer_status AS ENUM (
    'pending_review',
    'awaiting_old_owner_confirmation',
    'awaiting_new_owner_confirmation',
    'approved',
    'processing',
    'completed',
    'cancelled',
    'rejected',
    'expired',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_transfer_type AS ENUM ('personal_transfer', 'business_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.account_ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  old_client_id UUID NOT NULL,
  new_client_id UUID,
  new_client_email TEXT,
  new_client_payload JSONB,
  requested_by UUID NOT NULL,
  status public.account_transfer_status NOT NULL DEFAULT 'pending_review',
  transfer_type public.account_transfer_type NOT NULL DEFAULT 'personal_transfer',
  services_transferred JSONB NOT NULL DEFAULT '[]'::jsonb,
  billing_transfer_option TEXT NOT NULL CHECK (billing_transfer_option IN ('new_owner_all','old_keeps_debt','full_transfer')),
  equipment_transfer_option TEXT NOT NULL DEFAULT 'transfer_all',
  service_address_option TEXT NOT NULL DEFAULT 'keep',
  new_service_address JSONB,
  old_owner_confirmed_at TIMESTAMPTZ,
  new_owner_confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  reason TEXT,
  admin_override BOOLEAN NOT NULL DEFAULT false,
  admin_override_reason TEXT,
  confirmation_token_old TEXT UNIQUE,
  confirmation_token_new TEXT UNIQUE,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_ownership_transfers TO authenticated;
GRANT ALL ON public.account_ownership_transfers TO service_role;

ALTER TABLE public.account_ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and supervisors can view transfers"
  ON public.account_ownership_transfers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE INDEX IF NOT EXISTS idx_aot_account ON public.account_ownership_transfers(account_id);
CREATE INDEX IF NOT EXISTS idx_aot_old_client ON public.account_ownership_transfers(old_client_id);
CREATE INDEX IF NOT EXISTS idx_aot_new_client ON public.account_ownership_transfers(new_client_id);
CREATE INDEX IF NOT EXISTS idx_aot_status ON public.account_ownership_transfers(status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aot_updated_at ON public.account_ownership_transfers;
CREATE TRIGGER trg_aot_updated_at
  BEFORE UPDATE ON public.account_ownership_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- Idempotency table
CREATE TABLE IF NOT EXISTS public.account_transfer_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_transfer_idempotency TO authenticated;
GRANT ALL ON public.account_transfer_idempotency TO service_role;

ALTER TABLE public.account_transfer_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read transfer idempotency"
  ON public.account_transfer_idempotency
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ati_key ON public.account_transfer_idempotency(idempotency_key);

DROP TRIGGER IF EXISTS trg_ati_updated_at ON public.account_transfer_idempotency;
CREATE TRIGGER trg_ati_updated_at
  BEFORE UPDATE ON public.account_transfer_idempotency
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- State machine RPC
CREATE OR REPLACE FUNCTION public.rpc_account_transfer_transition(
  p_transfer_id UUID,
  p_next_status public.account_transfer_status,
  p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.account_transfer_status;
  v_allowed BOOLEAN := false;
BEGIN
  SELECT status INTO v_current FROM public.account_ownership_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  -- Terminal states cannot transition
  IF v_current IN ('completed','cancelled','rejected','expired','failed') THEN
    RAISE EXCEPTION 'transfer_terminal_state: %', v_current;
  END IF;

  -- Allowed forward transitions
  v_allowed := CASE
    WHEN v_current = 'pending_review' AND p_next_status IN ('awaiting_old_owner_confirmation','cancelled','rejected','failed') THEN true
    WHEN v_current = 'awaiting_old_owner_confirmation' AND p_next_status IN ('awaiting_new_owner_confirmation','cancelled','rejected','expired','failed') THEN true
    WHEN v_current = 'awaiting_new_owner_confirmation' AND p_next_status IN ('approved','cancelled','rejected','expired','failed') THEN true
    WHEN v_current = 'approved' AND p_next_status IN ('processing','cancelled','failed') THEN true
    WHEN v_current = 'processing' AND p_next_status IN ('completed','failed') THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition: % -> %', v_current, p_next_status;
  END IF;

  UPDATE public.account_ownership_transfers
     SET status = p_next_status,
         completed_at = CASE WHEN p_next_status = 'completed' THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN p_next_status IN ('cancelled','rejected') THEN now() ELSE cancelled_at END,
         updated_at = now()
   WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'from', v_current, 'to', p_next_status);
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_account_transfer_transition(UUID, public.account_transfer_status, UUID) TO service_role;
