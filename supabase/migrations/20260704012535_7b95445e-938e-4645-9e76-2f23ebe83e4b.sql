
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.billing_invoice_lines ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.billing_invoice_lines ADD COLUMN IF NOT EXISTS prorata_metadata jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.service_instances ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.equipment_inventory ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.installation_appointments ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.installation_jobs ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.technician_assignments ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.service_incidents ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_sa ON public.subscriptions(service_address_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_sa ON public.billing_subscriptions(service_address_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_lines_sa ON public.billing_invoice_lines(service_address_id);
CREATE INDEX IF NOT EXISTS idx_services_sa ON public.services(service_address_id);
CREATE INDEX IF NOT EXISTS idx_service_instances_sa ON public.service_instances(service_address_id);
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_sa ON public.equipment_inventory(service_address_id);
CREATE INDEX IF NOT EXISTS idx_appointments_sa ON public.appointments(service_address_id);
CREATE INDEX IF NOT EXISTS idx_installation_appointments_sa ON public.installation_appointments(service_address_id);
CREATE INDEX IF NOT EXISTS idx_installation_jobs_sa ON public.installation_jobs(service_address_id);
CREATE INDEX IF NOT EXISTS idx_technician_assignments_sa ON public.technician_assignments(service_address_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sa ON public.support_tickets(service_address_id);
CREATE INDEX IF NOT EXISTS idx_service_incidents_sa ON public.service_incidents(service_address_id);

-- Backfill (only tables with a direct account_id column)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT account_id, (array_agg(id))[1] AS the_id
    FROM public.service_addresses
    WHERE deleted_at IS NULL AND account_id IS NOT NULL
    GROUP BY account_id HAVING COUNT(*) = 1
  LOOP
    UPDATE public.subscriptions SET service_address_id = r.the_id WHERE account_id = r.account_id AND service_address_id IS NULL;
    UPDATE public.equipment_inventory SET service_address_id = r.the_id WHERE account_id = r.account_id AND service_address_id IS NULL;
    UPDATE public.support_tickets SET service_address_id = r.the_id WHERE account_id = r.account_id AND service_address_id IS NULL;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.v_account_address_summary
WITH (security_invoker = on) AS
SELECT
  sa.id AS service_address_id, sa.account_id,
  sa.address_line AS address_line_1, sa.city, sa.province, sa.postal_code, sa.created_at, sa.deleted_at,
  (SELECT COUNT(*) FROM public.subscriptions s WHERE s.service_address_id = sa.id AND s.status IN ('active','trialing','past_due')) AS active_subscriptions,
  (SELECT COUNT(*) FROM public.equipment_inventory e WHERE e.service_address_id = sa.id) AS equipment_count,
  (SELECT COUNT(*) FROM public.support_tickets t WHERE t.service_address_id = sa.id AND t.status <> 'closed') AS open_tickets
FROM public.service_addresses sa;

GRANT SELECT ON public.v_account_address_summary TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_account_service_tree(_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = _account_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'account_id', _account_id,
    'addresses', COALESCE(jsonb_agg(addr_obj ORDER BY created_at), '[]'::jsonb)
  ) INTO result
  FROM (
    SELECT sa.created_at, jsonb_build_object(
      'address', to_jsonb(sa.*),
      'subscriptions', COALESCE((SELECT jsonb_agg(to_jsonb(s.*)) FROM public.subscriptions s WHERE s.service_address_id = sa.id), '[]'::jsonb),
      'equipment', COALESCE((SELECT jsonb_agg(to_jsonb(e.*)) FROM public.equipment_inventory e WHERE e.service_address_id = sa.id), '[]'::jsonb),
      'appointments', COALESCE((SELECT jsonb_agg(to_jsonb(ap.*)) FROM public.appointments ap WHERE ap.service_address_id = sa.id), '[]'::jsonb),
      'tickets', COALESCE((SELECT jsonb_agg(to_jsonb(t.*)) FROM public.support_tickets t WHERE t.service_address_id = sa.id), '[]'::jsonb),
      'incidents', COALESCE((SELECT jsonb_agg(to_jsonb(i.*)) FROM public.service_incidents i WHERE i.service_address_id = sa.id), '[]'::jsonb)
    ) AS addr_obj
    FROM public.service_addresses sa
    WHERE sa.account_id = _account_id AND sa.deleted_at IS NULL
  ) sub;
  RETURN COALESCE(result, jsonb_build_object('account_id', _account_id, 'addresses', '[]'::jsonb));
END; $$;

GRANT EXECUTE ON FUNCTION public.get_account_service_tree(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.format_invoice_line_description(_base_description text, _service_address_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE addr_line text;
BEGIN
  IF _service_address_id IS NULL THEN RETURN _base_description; END IF;
  SELECT concat(address_line, ', ', city) INTO addr_line FROM public.service_addresses WHERE id = _service_address_id;
  IF addr_line IS NULL THEN RETURN _base_description; END IF;
  RETURN concat('[', addr_line, '] ', _base_description);
END; $$;

GRANT EXECUTE ON FUNCTION public.format_invoice_line_description(text, uuid) TO authenticated, service_role;
