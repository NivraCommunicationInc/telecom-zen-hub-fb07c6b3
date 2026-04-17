-- ═══════════════════════════════════════════════════════════════
-- SUPPLIER ACCOUNTS — Private admin-only registry
-- ═══════════════════════════════════════════════════════════════

-- ─── Encryption key store (admin-only, locked down) ─────────────
CREATE TABLE IF NOT EXISTS public.supplier_secrets (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  encryption_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_secrets ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies → totally inaccessible from client
-- Only SECURITY DEFINER functions can read this table

INSERT INTO public.supplier_secrets (id, encryption_key)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- ─── Main table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  mothers_maiden_name text NOT NULL,
  account_email text NOT NULL,
  account_password_encrypted bytea NOT NULL,
  service_name text NOT NULL,
  monthly_price numeric(10,2) NOT NULL CHECK (monthly_price >= 0),
  activation_date date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_accounts_client_id ON public.supplier_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_supplier_accounts_status ON public.supplier_accounts(status);
CREATE INDEX IF NOT EXISTS idx_supplier_accounts_created_at ON public.supplier_accounts(created_at DESC);

ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_accounts_admin_select" ON public.supplier_accounts;
DROP POLICY IF EXISTS "supplier_accounts_admin_insert" ON public.supplier_accounts;
DROP POLICY IF EXISTS "supplier_accounts_admin_update" ON public.supplier_accounts;
DROP POLICY IF EXISTS "supplier_accounts_admin_delete" ON public.supplier_accounts;

CREATE POLICY "supplier_accounts_admin_select" ON public.supplier_accounts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "supplier_accounts_admin_insert" ON public.supplier_accounts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "supplier_accounts_admin_update" ON public.supplier_accounts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "supplier_accounts_admin_delete" ON public.supplier_accounts
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_supplier_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_accounts_updated_at ON public.supplier_accounts;
CREATE TRIGGER trg_supplier_accounts_updated_at
  BEFORE UPDATE ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_supplier_accounts_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Helper: get encryption key (private, definer only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._supplier_get_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT encryption_key FROM public.supplier_secrets WHERE id = true;
$$;

REVOKE ALL ON FUNCTION public._supplier_get_key() FROM PUBLIC;
-- Not granted to authenticated — only callable from other definer functions

-- ═══════════════════════════════════════════════════════════════
-- RPC: create_supplier_account
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_supplier_account(
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_mothers_maiden_name text,
  p_account_email text,
  p_account_password text,
  p_service_name text,
  p_monthly_price numeric,
  p_activation_date date,
  p_status text DEFAULT 'active',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized — admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_account_password IS NULL OR length(p_account_password) = 0 THEN
    RAISE EXCEPTION 'Password is required';
  END IF;

  v_key := public._supplier_get_key();
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  INSERT INTO public.supplier_accounts (
    client_id, first_name, last_name, date_of_birth, mothers_maiden_name,
    account_email, account_password_encrypted,
    service_name, monthly_price, activation_date,
    status, notes, created_by
  ) VALUES (
    p_client_id, p_first_name, p_last_name, p_date_of_birth, p_mothers_maiden_name,
    p_account_email, pgp_sym_encrypt(p_account_password, v_key),
    p_service_name, p_monthly_price, p_activation_date,
    COALESCE(p_status, 'active'), p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.admin_security_audit (
    admin_user_id, action, target_type, target_id, details
  ) VALUES (
    auth.uid(), 'supplier_account_created', 'supplier_account', v_id::text,
    jsonb_build_object('client_id', p_client_id, 'service', p_service_name)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_supplier_account(uuid, text, text, date, text, text, text, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_supplier_account(uuid, text, text, date, text, text, text, text, numeric, date, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- RPC: update_supplier_account (NULL password = unchanged)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_supplier_account(
  p_id uuid,
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_mothers_maiden_name text,
  p_account_email text,
  p_account_password text,
  p_service_name text,
  p_monthly_price numeric,
  p_activation_date date,
  p_status text,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_password_changed boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized — admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_account_password IS NOT NULL AND length(p_account_password) > 0 THEN
    v_key := public._supplier_get_key();
    UPDATE public.supplier_accounts SET
      account_password_encrypted = pgp_sym_encrypt(p_account_password, v_key)
    WHERE id = p_id;
    v_password_changed := true;
  END IF;

  UPDATE public.supplier_accounts SET
    client_id = p_client_id,
    first_name = p_first_name,
    last_name = p_last_name,
    date_of_birth = p_date_of_birth,
    mothers_maiden_name = p_mothers_maiden_name,
    account_email = p_account_email,
    service_name = p_service_name,
    monthly_price = p_monthly_price,
    activation_date = p_activation_date,
    status = COALESCE(p_status, status),
    notes = p_notes
  WHERE id = p_id;

  INSERT INTO public.admin_security_audit (
    admin_user_id, action, target_type, target_id, details
  ) VALUES (
    auth.uid(), 'supplier_account_updated', 'supplier_account', p_id::text,
    jsonb_build_object('password_changed', v_password_changed)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_supplier_account(uuid, uuid, text, text, date, text, text, text, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_supplier_account(uuid, uuid, text, text, date, text, text, text, text, numeric, date, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- RPC: reveal_supplier_password (always audits)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reveal_supplier_password(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_encrypted bytea;
  v_client_id uuid;
  v_password text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.admin_security_audit (
      admin_user_id, action, target_type, target_id, details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'supplier_password_view_denied', 'supplier_account', p_id::text,
      jsonb_build_object('reason', 'not_admin')
    );
    RAISE EXCEPTION 'Unauthorized — admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT account_password_encrypted, client_id
    INTO v_encrypted, v_client_id
    FROM public.supplier_accounts
    WHERE id = p_id;

  IF v_encrypted IS NULL THEN
    RAISE EXCEPTION 'Supplier account not found';
  END IF;

  v_key := public._supplier_get_key();
  v_password := pgp_sym_decrypt(v_encrypted, v_key);

  INSERT INTO public.admin_security_audit (
    admin_user_id, action, target_type, target_id, details
  ) VALUES (
    auth.uid(), 'supplier_password_viewed', 'supplier_account', p_id::text,
    jsonb_build_object('client_id', v_client_id)
  );

  RETURN v_password;
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_supplier_password(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_supplier_password(uuid) TO authenticated;