-- ==============================================================================
-- GROWTH PHASE D — crm_contacts ready for website lead capture
-- ==============================================================================
-- The new public landing page (/internet-pas-cher-quebec) and the
-- crm-lead-capture edge function need a postal_code column on
-- crm_contacts. The Shopify backfill stored the postal code in the
-- 'state' column (POS export quirk) — we keep that historical data
-- intact and just add a clean column for new website leads.
--
-- Idempotent — safe to re-apply.
-- ==============================================================================

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS postal_code text;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_postal_code
  ON public.crm_contacts(postal_code)
  WHERE postal_code IS NOT NULL;

COMMENT ON COLUMN public.crm_contacts.postal_code IS
  'Optional postal code captured from website lead capture form. Distinct from the historical Shopify-import "state" column which sometimes holds postal codes too.';

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'GROWTH_PHASE_D_LEAD_CAPTURE_READY',
  'info',
  jsonb_build_object(
    'note', 'Added crm_contacts.postal_code so the public lead-capture form can persist clean structured data.',
    'landing_page', '/internet-pas-cher-quebec',
    'edge_function', 'crm-lead-capture'
  )
);
