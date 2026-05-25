-- ==============================================================================
-- GROWTH PHASE A — CRM marketing consent (CASL / Loi 25)
-- ==============================================================================
-- Adds explicit consent tracking columns to crm_contacts and backfills the
-- existing Shopify/Square POS imports as CASL "implied consent" (24-month
-- window after a commercial relationship — s.10(9) Canada Anti-Spam Law).
--
-- Real opt-in collected on-site after Phase A will override this with
-- consent_source = 'explicit_form' / 'website_opt_in' etc.
--
-- Excluded from backfill:
--   - rows with NULL / empty email
--   - placeholder addresses (noemail@*, normail@*, none@*, pasdemail@*, etc.)
--   - addresses that don't match a basic RFC-compatible regex
--   - any email already present in email_unsubscribes (is_active = true)
-- ==============================================================================

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_marketing_email_at timestamptz;

COMMENT ON COLUMN public.crm_contacts.marketing_consent IS
  'CASL/Loi-25 consent flag. true = we may send commercial email. Source is recorded in consent_source.';
COMMENT ON COLUMN public.crm_contacts.consent_source IS
  'Origin of the consent: casl_implied_purchase_shopify, explicit_form, website_opt_in, referral, manual_staff, etc.';
COMMENT ON COLUMN public.crm_contacts.unsubscribed_at IS
  'Set when the recipient hits the one-click unsubscribe footer. Once set, agents must skip this contact.';

CREATE INDEX IF NOT EXISTS idx_crm_contacts_consent_active
  ON public.crm_contacts(marketing_consent, unsubscribed_at)
  WHERE marketing_consent = true AND unsubscribed_at IS NULL;

-- ────────────────────────────────────────────────────────────────────
-- One-time backfill: mark Shopify/Square POS contacts as CASL-implied
-- ────────────────────────────────────────────────────────────────────
WITH eligible AS (
  UPDATE public.crm_contacts c
  SET
    marketing_consent = true,
    consent_source    = 'casl_implied_purchase_shopify',
    consent_date      = COALESCE(c.consent_date, c.created_at, now())
  WHERE c.marketing_consent = false
    AND c.unsubscribed_at IS NULL
    AND c.email IS NOT NULL
    AND length(trim(c.email)) > 0
    AND lower(c.email) NOT LIKE 'noemail@%'
    AND lower(c.email) NOT LIKE 'normail@%'
    AND lower(c.email) NOT LIKE 'aucun@%'
    AND lower(c.email) NOT LIKE 'none@%'
    AND lower(c.email) NOT LIKE 'no_email@%'
    AND lower(c.email) NOT LIKE 'pasdemail@%'
    AND lower(c.email) NOT LIKE 'sansmail@%'
    AND lower(c.email) NOT LIKE 'test@%'
    AND lower(c.email) NOT LIKE 'fake@%'
    -- Internal Nivra addresses: owner / staff registered themselves at POS
    -- and must never receive marketing as primary recipient (BCC only).
    AND lower(c.email) NOT LIKE '%@nivra-telecom.ca'
    AND lower(c.email) NOT LIKE '%@nivratelecom.ca'
    AND lower(c.email) NOT IN (
      'nivratelecom@gmail.com',
      'nivratelecom@hotmail.com',
      'support@nivra-telecom.ca',
      'admin@nivra-telecom.ca',
      'info@nivra-telecom.ca',
      'noreply@nivra-telecom.ca',
      'billing@nivra-telecom.ca'
    )
    AND c.email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND NOT EXISTS (
      SELECT 1
      FROM public.email_unsubscribes eu
      WHERE lower(eu.email) = lower(c.email)
        AND eu.is_active = true
    )
  RETURNING c.id
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'GROWTH_PHASE_A_CONSENT_BACKFILL',
  'info',
  jsonb_build_object(
    'consenting_contacts', (SELECT count(*) FROM eligible),
    'note', 'CRM contacts marked CASL-implied (24-month window from Shopify/Square purchase). Unsubscribe link mandatory in every email.',
    'rule', 'consent_source=casl_implied_purchase_shopify'
  );
