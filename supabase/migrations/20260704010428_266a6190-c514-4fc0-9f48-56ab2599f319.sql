
-- =========================================================================
-- PASS 3A + 3C — Multi-address entity + traceability + prorata support
-- =========================================================================

-- Add enum value FIRST (must be committed before use, but only referenced by app code)
ALTER TYPE public.billing_invoice_type ADD VALUE IF NOT EXISTS 'prorata_activation';

-- ---------- 1. Enrich account_service_locations ---------------------------
ALTER TABLE public.account_service_locations
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
  ALTER TABLE public.account_service_locations
    ADD CONSTRAINT account_service_locations_created_via_chk
    CHECK (created_via IS NULL OR created_via IN
      ('guest_checkout','portal','field','core','pos','employee','backfill','migration'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_svc_loc_account_active
  ON public.account_service_locations(account_id, is_active)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_svc_loc_account_addr_postal
  ON public.account_service_locations(
    account_id,
    lower(regexp_replace(coalesce(service_address,''), '\s+', ' ', 'g')),
    upper(regexp_replace(coalesce(service_postal_code,''), '\s+', '', 'g'))
  )
  WHERE deleted_at IS NULL;

-- ---------- 2. History table (immutable audit) ---------------------------
CREATE TABLE IF NOT EXISTS public.service_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_location_id uuid NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_svc_loc_hist_loc ON public.service_location_history(service_location_id);
CREATE INDEX IF NOT EXISTS idx_svc_loc_hist_account ON public.service_location_history(account_id);

GRANT SELECT ON public.service_location_history TO authenticated;
GRANT ALL ON public.service_location_history TO service_role;

ALTER TABLE public.service_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all svc loc history" ON public.service_location_history;
CREATE POLICY "Admins can read all svc loc history"
  ON public.service_location_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners can read own svc loc history" ON public.service_location_history;
CREATE POLICY "Owners can read own svc loc history"
  ON public.service_location_history FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "Deny anon svc loc history" ON public.service_location_history;
CREATE POLICY "Deny anon svc loc history"
  ON public.service_location_history FOR ALL TO anon USING (false);

CREATE OR REPLACE FUNCTION public.log_service_location_history()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event text;
  v_loc_id uuid;
  v_acc_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'created'; v_loc_id := NEW.id; v_acc_id := NEW.account_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN v_event := 'soft_deleted';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN v_event := 'restored';
    ELSE v_event := 'updated'; END IF;
    v_loc_id := NEW.id; v_acc_id := NEW.account_id;
  ELSE
    v_event := 'soft_deleted'; v_loc_id := OLD.id; v_acc_id := OLD.account_id;
  END IF;

  INSERT INTO public.service_location_history(
    service_location_id, account_id, event_type,
    actor_user_id, portal_source, order_id, employee_id, field_agent_id, metadata
  ) VALUES (
    v_loc_id, v_acc_id, v_event,
    coalesce(NEW.created_by_user_id, auth.uid()),
    NEW.created_via,
    NEW.created_from_order_id,
    NEW.created_by_employee_id,
    NEW.created_by_field_agent_id,
    jsonb_build_object(
      'label', NEW.label,
      'service_address', NEW.service_address,
      'service_city', NEW.service_city,
      'service_postal_code', NEW.service_postal_code
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_svc_loc_history_ins ON public.account_service_locations;
CREATE TRIGGER trg_log_svc_loc_history_ins
  AFTER INSERT ON public.account_service_locations
  FOR EACH ROW EXECUTE FUNCTION public.log_service_location_history();

DROP TRIGGER IF EXISTS trg_log_svc_loc_history_upd ON public.account_service_locations;
CREATE TRIGGER trg_log_svc_loc_history_upd
  AFTER UPDATE ON public.account_service_locations
  FOR EACH ROW EXECUTE FUNCTION public.log_service_location_history();

-- ---------- 3. service_location_id everywhere ----------------------------
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_billing_subs_svc_loc ON public.billing_subscriptions(service_location_id);

ALTER TABLE public.billing_invoice_lines
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_billing_inv_lines_svc_loc ON public.billing_invoice_lines(service_location_id);

ALTER TABLE public.equipment_inventory
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_equipment_svc_loc ON public.equipment_inventory(service_location_id);

ALTER TABLE public.installations
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_installations_svc_loc ON public.installations(service_location_id);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_appointments_svc_loc ON public.appointments(service_location_id);

ALTER TABLE public.service_incidents
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_incidents_svc_loc ON public.service_incidents(service_location_id);

ALTER TABLE public.technician_assignments
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_tech_assign_svc_loc ON public.technician_assignments(service_location_id);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_svc_loc ON public.support_tickets(service_location_id);

-- ---------- 4. Backfill -------------------------------------------------
INSERT INTO public.account_service_locations(
  account_id, label, service_address, service_city, service_province, service_postal_code,
  is_active, created_via
)
SELECT a.id, 'Adresse principale',
       a.primary_service_address, a.primary_service_city, 'QC', a.primary_service_postal_code,
       true, 'backfill'
FROM public.accounts a
WHERE a.primary_service_address IS NOT NULL
  AND a.primary_service_address <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.account_service_locations l
    WHERE l.account_id = a.id AND l.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;

UPDATE public.orders o
SET service_location_id = (
  SELECT l.id FROM public.account_service_locations l
  WHERE l.account_id = o.account_id AND l.deleted_at IS NULL
  ORDER BY l.created_at ASC LIMIT 1
)
WHERE o.service_location_id IS NULL AND o.account_id IS NOT NULL;

UPDATE public.billing_subscriptions s
SET service_location_id = o.service_location_id
FROM public.orders o
WHERE s.order_id = o.id AND s.service_location_id IS NULL AND o.service_location_id IS NOT NULL;

UPDATE public.installations i
SET service_location_id = o.service_location_id
FROM public.orders o
WHERE i.order_id = o.id AND i.service_location_id IS NULL AND o.service_location_id IS NOT NULL;

UPDATE public.appointments ap
SET service_location_id = o.service_location_id
FROM public.orders o
WHERE ap.order_id = o.id AND ap.service_location_id IS NULL AND o.service_location_id IS NOT NULL;

UPDATE public.equipment_inventory e
SET service_location_id = o.service_location_id
FROM public.orders o
WHERE e.order_id = o.id AND e.service_location_id IS NULL AND o.service_location_id IS NOT NULL;

UPDATE public.billing_invoice_lines bl
SET service_location_id = s.service_location_id
FROM public.billing_invoices bi
JOIN public.billing_subscriptions s ON s.id = bi.subscription_id
WHERE bl.invoice_id = bi.id AND bl.service_location_id IS NULL AND s.service_location_id IS NOT NULL;

-- ---------- 5. RPC resolve_or_create_service_location -------------------
CREATE OR REPLACE FUNCTION public.resolve_or_create_service_location(
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
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_norm_addr text := lower(regexp_replace(coalesce(p_address,''), '\s+', ' ', 'g'));
  v_norm_postal text := upper(regexp_replace(coalesce(p_postal,''), '\s+', '', 'g'));
BEGIN
  IF p_account_id IS NULL OR p_address IS NULL OR p_address = '' THEN
    RAISE EXCEPTION 'account_id and address required';
  END IF;
  IF p_created_via NOT IN ('guest_checkout','portal','field','core','pos','employee','backfill','migration') THEN
    RAISE EXCEPTION 'invalid created_via: %', p_created_via;
  END IF;

  SELECT id INTO v_id
  FROM public.account_service_locations
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
    AND lower(regexp_replace(coalesce(service_address,''), '\s+', ' ', 'g')) = v_norm_addr
    AND upper(regexp_replace(coalesce(service_postal_code,''), '\s+', '', 'g')) = v_norm_postal
  LIMIT 1;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.account_service_locations(
    account_id, label, service_address, service_city, service_province, service_postal_code,
    is_active, created_by_user_id, created_via, created_from_order_id,
    created_by_employee_id, created_by_field_agent_id
  ) VALUES (
    p_account_id,
    coalesce(p_label, 'Adresse ' || (
      SELECT count(*)+1 FROM public.account_service_locations
      WHERE account_id = p_account_id AND deleted_at IS NULL
    )::text),
    p_address, p_city, coalesce(p_province,'QC'), p_postal,
    true, p_actor_user_id, p_created_via, p_order_id,
    p_employee_id, p_field_agent_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_service_location(
  uuid, text, text, text, text, text, uuid, uuid, uuid, uuid, text
) TO authenticated, service_role;
