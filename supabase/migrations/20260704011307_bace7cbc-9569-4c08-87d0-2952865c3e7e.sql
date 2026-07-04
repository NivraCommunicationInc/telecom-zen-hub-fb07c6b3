
-- =========================================================================
-- R1 — Unify address model on service_addresses (canonical)
-- =========================================================================

-- ---------- 1. Enrich service_addresses with traceability ---------------
ALTER TABLE public.service_addresses
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_via text,
  ADD COLUMN IF NOT EXISTS created_from_order_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_employee_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_field_agent_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

DO $$ BEGIN
  ALTER TABLE public.service_addresses
    ADD CONSTRAINT service_addresses_created_via_chk
    CHECK (created_via IS NULL OR created_via IN
      ('guest_checkout','portal','field','core','pos','employee','backfill','migration','admin','legacy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_svc_addr_account_active
  ON public.service_addresses(account_id, is_active)
  WHERE deleted_at IS NULL;

-- ---------- 2. Drop the max-2 limit --------------------------------------
DROP TRIGGER IF EXISTS trg_max_two_service_addresses ON public.service_addresses;
DROP FUNCTION IF EXISTS public.enforce_max_two_service_addresses();

-- ---------- 3. History table --------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_address_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_address_id uuid NOT NULL,
  account_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','soft_deleted','restored')),
  actor_user_id uuid,
  actor_role text,
  portal_source text,
  order_id uuid,
  employee_id uuid,
  field_agent_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_svc_addr_hist_addr ON public.service_address_history(service_address_id);
CREATE INDEX IF NOT EXISTS idx_svc_addr_hist_account ON public.service_address_history(account_id);

GRANT SELECT ON public.service_address_history TO authenticated;
GRANT ALL ON public.service_address_history TO service_role;

ALTER TABLE public.service_address_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all svc addr history" ON public.service_address_history;
CREATE POLICY "Admins can read all svc addr history"
  ON public.service_address_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners can read own svc addr history" ON public.service_address_history;
CREATE POLICY "Owners can read own svc addr history"
  ON public.service_address_history FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "Deny anon svc addr history" ON public.service_address_history;
CREATE POLICY "Deny anon svc addr history"
  ON public.service_address_history FOR ALL TO anon USING (false);

CREATE OR REPLACE FUNCTION public.log_service_address_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_event text; v_addr_id uuid; v_acc_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'created'; v_addr_id := NEW.id; v_acc_id := NEW.account_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN v_event := 'soft_deleted';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN v_event := 'restored';
    ELSE v_event := 'updated'; END IF;
    v_addr_id := NEW.id; v_acc_id := NEW.account_id;
  ELSE
    v_event := 'soft_deleted'; v_addr_id := OLD.id; v_acc_id := OLD.account_id;
  END IF;

  INSERT INTO public.service_address_history(
    service_address_id, account_id, event_type,
    actor_user_id, portal_source, order_id, employee_id, field_agent_id, metadata
  ) VALUES (
    v_addr_id, v_acc_id, v_event,
    coalesce(NEW.created_by_user_id, auth.uid()),
    NEW.created_via,
    NEW.created_from_order_id,
    NEW.created_by_employee_id,
    NEW.created_by_field_agent_id,
    jsonb_build_object(
      'label', NEW.label,
      'address_line', NEW.address_line,
      'city', NEW.city,
      'province', NEW.province,
      'postal_code', NEW.postal_code
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_svc_addr_history_ins ON public.service_addresses;
CREATE TRIGGER trg_log_svc_addr_history_ins
  AFTER INSERT ON public.service_addresses
  FOR EACH ROW EXECUTE FUNCTION public.log_service_address_history();

DROP TRIGGER IF EXISTS trg_log_svc_addr_history_upd ON public.service_addresses;
CREATE TRIGGER trg_log_svc_addr_history_upd
  AFTER UPDATE ON public.service_addresses
  FOR EACH ROW EXECUTE FUNCTION public.log_service_address_history();

-- ---------- 4. Backfill: no data loss during transition -----------------
-- 4a. Accounts with primary address but no service_addresses row
INSERT INTO public.service_addresses(
  account_id, label, address_line, city, province, postal_code,
  is_active, is_default, created_via
)
SELECT a.id,
       'Adresse principale',
       a.primary_service_address,
       a.primary_service_city,
       coalesce(a.primary_service_province, 'QC'),
       a.primary_service_postal_code,
       true, true, 'backfill'
FROM public.accounts a
WHERE a.primary_service_address IS NOT NULL
  AND a.primary_service_address <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.service_addresses s
    WHERE s.account_id = a.id AND s.is_active
  )
ON CONFLICT DO NOTHING;

-- 4b. Copy addresses that only exist in account_service_locations
INSERT INTO public.service_addresses(
  account_id, label, address_line, city, province, postal_code,
  is_active, is_default, created_via, notes
)
SELECT
  asl.account_id,
  coalesce(asl.label, 'Adresse'),
  asl.service_address,
  asl.service_city,
  coalesce(asl.service_province, 'QC'),
  asl.service_postal_code,
  true,
  NOT EXISTS (SELECT 1 FROM public.service_addresses s WHERE s.account_id = asl.account_id AND s.is_default),
  'backfill',
  'Migré depuis account_service_locations le ' || now()::date
FROM public.account_service_locations asl
WHERE asl.is_active AND asl.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.service_addresses s
    WHERE s.account_id = asl.account_id
      AND s.is_active
      AND lower(regexp_replace(coalesce(s.address_line,''), '\s+', ' ', 'g'))
        = lower(regexp_replace(coalesce(asl.service_address,''), '\s+', ' ', 'g'))
      AND upper(regexp_replace(coalesce(s.postal_code,''), '\s+', '', 'g'))
        = upper(regexp_replace(coalesce(asl.service_postal_code,''), '\s+', '', 'g'))
  )
ON CONFLICT DO NOTHING;

-- ---------- 5. Canonical RPC on service_addresses -----------------------
CREATE OR REPLACE FUNCTION public.resolve_or_create_service_address(
  p_account_id uuid,
  p_address text,
  p_city text,
  p_province text,
  p_postal text,
  p_created_via text,
  p_actor_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_field_agent_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_norm_addr text := lower(regexp_replace(coalesce(p_address,''), '\s+', ' ', 'g'));
  v_norm_postal text := upper(regexp_replace(coalesce(p_postal,''), '\s+', '', 'g'));
BEGIN
  IF p_account_id IS NULL OR p_address IS NULL OR p_address = '' THEN
    RAISE EXCEPTION 'account_id and address required';
  END IF;
  IF p_created_via NOT IN ('guest_checkout','portal','field','core','pos','employee','backfill','migration','admin','legacy') THEN
    RAISE EXCEPTION 'invalid created_via: %', p_created_via;
  END IF;

  SELECT id INTO v_id
  FROM public.service_addresses
  WHERE account_id = p_account_id
    AND is_active
    AND lower(regexp_replace(coalesce(address_line,''), '\s+', ' ', 'g')) = v_norm_addr
    AND upper(regexp_replace(coalesce(postal_code,''), '\s+', '', 'g')) = v_norm_postal
  LIMIT 1;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.service_addresses(
    account_id, label, address_line, city, province, postal_code,
    is_active, is_default, created_by_user_id, created_via, created_from_order_id,
    created_by_employee_id, created_by_field_agent_id
  ) VALUES (
    p_account_id,
    coalesce(p_label, 'Adresse ' || (
      SELECT count(*)+1 FROM public.service_addresses
      WHERE account_id = p_account_id AND is_active
    )::text),
    p_address, p_city, coalesce(p_province,'QC'), p_postal,
    true,
    NOT EXISTS (SELECT 1 FROM public.service_addresses s2 WHERE s2.account_id = p_account_id AND s2.is_default AND s2.is_active),
    p_actor_user_id, p_created_via, p_order_id,
    p_employee_id, p_field_agent_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_service_address(
  uuid, text, text, text, text, text, uuid, uuid, uuid, uuid, text
) TO authenticated, service_role;

-- ---------- 6. Block new writes on account_service_locations -----------
COMMENT ON TABLE public.account_service_locations IS
  'DEPRECATED 2026-07-04 — DO NOT USE. Canonical table = public.service_addresses. '
  'This table is preserved for FK compatibility (orders.service_location_id, replacement_request_tickets.service_location_id). '
  'INSERTs are blocked by trigger trg_block_asl_insert. '
  'Removal planned 2026-Q4 after (a) FK migration to service_addresses.id, (b) confirmed zero reads via grep audit.';

CREATE OR REPLACE FUNCTION public.block_account_service_locations_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'account_service_locations is DEPRECATED. Use public.service_addresses and RPC resolve_or_create_service_address(). See docs/ADDRESS_MODEL_CANONICAL.md.'
    USING ERRCODE = 'feature_not_supported',
          HINT = 'Removal planned 2026-Q4';
END $$;

DROP TRIGGER IF EXISTS trg_block_asl_insert ON public.account_service_locations;
CREATE TRIGGER trg_block_asl_insert
  BEFORE INSERT ON public.account_service_locations
  FOR EACH ROW EXECUTE FUNCTION public.block_account_service_locations_insert();

-- Also deprecate the location-flavored RPC I created yesterday
COMMENT ON FUNCTION public.resolve_or_create_service_location(uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text) IS
  'DEPRECATED 2026-07-04 — Use resolve_or_create_service_address() instead. Removal planned 2026-Q4.';
