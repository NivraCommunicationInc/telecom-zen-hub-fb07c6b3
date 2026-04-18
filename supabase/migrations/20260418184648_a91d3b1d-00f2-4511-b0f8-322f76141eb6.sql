-- ════════════════════════════════════════════════════════════════════════════
-- PHASE A4 — Auto-send signature link when contract is created
-- ────────────────────────────────────────────────────────────────────────────
-- A single AFTER INSERT trigger on public.contracts that:
--   1. Generates a signature_token if missing (UUID, 30-day expiry)
--   2. Looks up client email + order context
--   3. Enqueues a contract_signature_request email via public.email_queue
--      (idempotent — skipped silently on any failure to never break inserts)
--
-- Catches ALL contract-creation paths automatically:
--   • AdminContracts.tsx manual creation
--   • field-sales-sync edge function
--   • Existing DB triggers (auto_create_contract_on_payment, etc.)
--   • Any future code path
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_auto_send_contract_signature_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_client_email text;
  v_client_name text;
  v_order_number text;
  v_event_key text;
BEGIN
  -- Only fire for contracts that need a client signature.
  -- Skip if already signed or void.
  IF NEW.client_signed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') IN ('void', 'cancelled', 'signed') THEN
    RETURN NEW;
  END IF;

  -- 1) Ensure signature_token exists (best-effort; if column missing skip)
  v_token := COALESCE(NEW.signature_token, gen_random_uuid()::text);

  IF NEW.signature_token IS NULL THEN
    BEGIN
      UPDATE public.contracts
      SET signature_token = v_token,
          signature_token_expires_at = COALESCE(signature_token_expires_at, now() + interval '30 days')
      WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- Never block the insert
      RAISE NOTICE '[auto_send_contract_sig] token update failed for %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
  END IF;

  -- 2) Resolve client email + name (best-effort)
  BEGIN
    SELECT
      COALESCE(p.email, ''),
      COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Client')
    INTO v_client_email, v_client_name
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_client_email := NULL;
  END;

  -- Resolve order number if linked
  IF NEW.order_id IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(o.order_number, '')
      INTO v_order_number
      FROM public.orders o
      WHERE o.id = NEW.order_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_order_number := NULL;
    END;
  END IF;

  -- Bail silently if no email destination
  IF v_client_email IS NULL OR v_client_email = '' THEN
    RAISE NOTICE '[auto_send_contract_sig] no client email for contract %', NEW.id;
    RETURN NEW;
  END IF;

  -- 3) Enqueue email (idempotent via event_key on contract id)
  v_event_key := 'contract_signature_request:' || NEW.id::text;

  BEGIN
    INSERT INTO public.email_queue (
      event_key,
      to_email,
      template_key,
      template_vars,
      status,
      message_type,
      entity_type,
      entity_id
    )
    SELECT
      v_event_key,
      v_client_email,
      'contract_signature_request',
      jsonb_build_object(
        'client_name', v_client_name,
        'signature_url', 'https://nivra-telecom.ca/sign/' || v_token,
        'order_number', COALESCE(v_order_number, ''),
        'contract_number', COALESCE(NEW.contract_number, '')
      ),
      'pending',
      'transactional',
      'contract',
      NEW.id::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.email_queue
      WHERE event_key = v_event_key
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block the insert; log and move on
    RAISE NOTICE '[auto_send_contract_sig] enqueue failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS trg_auto_send_contract_signature_link ON public.contracts;

CREATE TRIGGER trg_auto_send_contract_signature_link
AFTER INSERT ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_send_contract_signature_link();

COMMENT ON FUNCTION public.fn_auto_send_contract_signature_link() IS
'Phase A4: Auto-generates signature_token and queues contract_signature_request email when a new contract is created. Idempotent via event_key. Best-effort — never blocks contract inserts.';