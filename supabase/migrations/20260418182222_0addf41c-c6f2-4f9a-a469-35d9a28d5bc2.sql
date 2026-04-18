-- ═══════════════════════════════════════════════════════════════════
-- PHASE A — Click-to-sign electronic signature: legal-proof columns
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_signed_ip text,
  ADD COLUMN IF NOT EXISTS client_signed_user_agent text,
  ADD COLUMN IF NOT EXISTS signature_method text,
  ADD COLUMN IF NOT EXISTS client_signer_name text,
  ADD COLUMN IF NOT EXISTS client_consent_accepted boolean DEFAULT false;

COMMENT ON COLUMN public.contracts.client_signed_ip IS 'IP address captured at time of click-to-sign for legal proof (Loi 25)';
COMMENT ON COLUMN public.contracts.client_signed_user_agent IS 'Browser user-agent at time of signature for legal proof';
COMMENT ON COLUMN public.contracts.signature_method IS 'click_to_sign | wet_signature | docusign | admin_signed';
COMMENT ON COLUMN public.contracts.client_signer_name IS 'Full name as typed/confirmed by client at signing time';

-- ═══════════════════════════════════════════════════════════════════
-- RPC: consume_contract_signature_token
-- Validates token + records signature with legal proof in one atomic op.
-- SECURITY DEFINER → callable from public edge function (no auth).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.consume_contract_signature_token(
  p_token text,
  p_signer_ip text,
  p_signer_user_agent text,
  p_signer_name text DEFAULT NULL,
  p_consent boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text;
  v_contract record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_INVALID');
  END IF;

  IF p_consent IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONSENT_REQUIRED');
  END IF;

  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT c.* INTO v_contract
  FROM public.contracts c
  WHERE c.signature_token_hash = v_token_hash
    AND c.signature_token IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  IF v_contract.signature_token_expires_at IS NOT NULL
     AND v_contract.signature_token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED');
  END IF;

  IF v_contract.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_SIGNED',
      'signed_at', v_contract.client_signed_at,
      'contract_id', v_contract.id
    );
  END IF;

  UPDATE public.contracts
  SET
    client_signed_at         = now(),
    signed_at                = COALESCE(signed_at, now()),
    is_signed                = true,
    client_signed_ip         = p_signer_ip,
    client_signed_user_agent = p_signer_user_agent,
    client_signer_name       = COALESCE(p_signer_name, client_signer_name),
    client_consent_accepted  = true,
    signature_method         = COALESCE(signature_method, 'click_to_sign'),
    signature_token_used_at  = now(),
    status                   = CASE
                                 WHEN admin_signed_at IS NOT NULL THEN 'fully_signed'
                                 ELSE 'signed_by_client'
                               END,
    updated_at               = now()
  WHERE id = v_contract.id;

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract.id,
    'order_id', v_contract.order_id,
    'signed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_contract_signature_token(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_contract_signature_token(text, text, text, text, boolean) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- RPC: get_contract_for_signing — read-only fetch by token (no auth)
-- Returns minimal client-facing snapshot to render the signing page.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_contract_for_signing(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text;
  v_contract record;
  v_order record;
  v_profile record;
  v_account record;
  v_invoice record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_INVALID');
  END IF;

  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT c.* INTO v_contract
  FROM public.contracts c
  WHERE c.signature_token_hash = v_token_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  IF v_contract.signature_token_expires_at IS NOT NULL
     AND v_contract.signature_token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED');
  END IF;

  IF v_contract.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_signed', true,
      'signed_at', v_contract.client_signed_at,
      'contract_number', v_contract.contract_number
    );
  END IF;

  -- Fetch related order
  IF v_contract.order_id IS NOT NULL THEN
    SELECT o.id, o.order_number, o.service_type, o.total_amount, o.created_at,
           o.service_address, o.service_city, o.service_postal_code, o.service_province,
           o.user_id
      INTO v_order
    FROM public.orders o
    WHERE o.id = v_contract.order_id;

    IF v_order.user_id IS NOT NULL THEN
      SELECT p.full_name, p.email, p.phone INTO v_profile
      FROM public.profiles p WHERE p.user_id = v_order.user_id;

      SELECT a.account_number INTO v_account
      FROM public.accounts a WHERE a.client_id = v_order.user_id LIMIT 1;
    END IF;

    SELECT bi.invoice_number, bi.total, bi.subtotal, bi.tps_amount, bi.tvq_amount
      INTO v_invoice
    FROM public.billing_invoices bi
    WHERE bi.order_id = v_contract.order_id
    ORDER BY bi.created_at DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_signed', false,
    'contract', jsonb_build_object(
      'id', v_contract.id,
      'contract_number', v_contract.contract_number,
      'contract_name', v_contract.contract_name,
      'version', v_contract.version,
      'created_at', v_contract.created_at,
      'expires_at', v_contract.signature_token_expires_at
    ),
    'order', CASE WHEN v_order.id IS NOT NULL THEN jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'service_type', v_order.service_type,
      'total_amount', v_order.total_amount,
      'created_at', v_order.created_at,
      'service_address', v_order.service_address,
      'service_city', v_order.service_city,
      'service_postal_code', v_order.service_postal_code,
      'service_province', v_order.service_province
    ) ELSE NULL END,
    'client', CASE WHEN v_profile.email IS NOT NULL THEN jsonb_build_object(
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'phone', v_profile.phone
    ) ELSE NULL END,
    'account_number', v_account.account_number,
    'invoice', CASE WHEN v_invoice.invoice_number IS NOT NULL THEN jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total', v_invoice.total,
      'subtotal', v_invoice.subtotal,
      'tps_amount', v_invoice.tps_amount,
      'tvq_amount', v_invoice.tvq_amount
    ) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_for_signing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_for_signing(text) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- PHASE C — SLA tracking on orders
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS sla_status text DEFAULT 'on_time';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sla_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sla_status_check
      CHECK (sla_status IN ('on_time','warning','overdue'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_sla_deadline ON public.orders(sla_deadline) WHERE sla_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sla_status ON public.orders(sla_status) WHERE sla_status IN ('warning','overdue');

-- Trigger: set SLA deadline = now() + 4h when an order enters 'submitted'
CREATE OR REPLACE FUNCTION public.fn_set_order_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' AND NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := now() + INTERVAL '4 hours';
    NEW.sla_status   := 'on_time';
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'submitted'
        AND COALESCE(OLD.status, '') <> 'submitted'
        AND NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := now() + INTERVAL '4 hours';
    NEW.sla_status   := 'on_time';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_sla ON public.orders;
CREATE TRIGGER trg_set_order_sla
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_order_sla();

-- Periodic update function (call from cron or manually) — does NOT change status of already-completed orders
CREATE OR REPLACE FUNCTION public.fn_update_orders_sla_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warning int := 0;
  v_overdue int := 0;
BEGIN
  UPDATE public.orders
     SET sla_status = 'warning'
   WHERE sla_deadline IS NOT NULL
     AND sla_deadline BETWEEN now() AND now() + INTERVAL '1 hour'
     AND sla_status   = 'on_time'
     AND status NOT IN ('activated','completed','cancelled','installation_completed','delivered');
  GET DIAGNOSTICS v_warning = ROW_COUNT;

  UPDATE public.orders
     SET sla_status = 'overdue'
   WHERE sla_deadline IS NOT NULL
     AND sla_deadline < now()
     AND sla_status <> 'overdue'
     AND status NOT IN ('activated','completed','cancelled','installation_completed','delivered');
  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  RETURN jsonb_build_object('warning_set', v_warning, 'overdue_set', v_overdue, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_orders_sla_status() TO service_role;

-- Backfill SLA for existing submitted orders that have no deadline yet
UPDATE public.orders
   SET sla_deadline = COALESCE(sla_deadline, created_at + INTERVAL '4 hours'),
       sla_status   = COALESCE(sla_status, 'on_time')
 WHERE status = 'submitted'
   AND sla_deadline IS NULL;