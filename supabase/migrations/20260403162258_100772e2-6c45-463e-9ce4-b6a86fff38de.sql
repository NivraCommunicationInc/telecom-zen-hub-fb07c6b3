
-- ============================================================
-- FIX 1: Identity documents — consolidate and tighten RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Users can view own identity documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Admin can view all documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Staff can view all identity documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Staff can view all documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Users can upload own documents" ON public.identity_documents;
DROP POLICY IF EXISTS "Service role can insert identity documents" ON public.identity_documents;

-- SELECT
CREATE POLICY "owners_read_own_identity_docs" ON public.identity_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.identity_verification_sessions s
      WHERE s.id = identity_documents.kyc_session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_identity_docs" ON public.identity_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "staff_read_identity_docs" ON public.identity_documents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'kyc_agent')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'support')
  );

-- INSERT
CREATE POLICY "owners_insert_identity_docs" ON public.identity_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    kyc_session_id IN (
      SELECT id FROM public.identity_verification_sessions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_insert_identity_docs" ON public.identity_documents
  FOR INSERT TO service_role
  WITH CHECK (true);

-- UPDATE/DELETE: service_role only
CREATE POLICY "service_role_update_identity_docs" ON public.identity_documents
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_delete_identity_docs" ON public.identity_documents
  FOR DELETE TO service_role
  USING (true);

-- ============================================================
-- FIX 2: Unified clients view — recreate with security_invoker
-- ============================================================
DROP VIEW IF EXISTS public.unified_clients;
CREATE VIEW public.unified_clients
WITH (security_invoker = on) AS
SELECT p.id, p.user_id, p.email, p.full_name, p.first_name, p.last_name,
    p.phone, p.created_at, p.client_number, p.service_address, p.service_city,
    p.service_postal_code, p.service_province, p.date_of_birth, p.sector_tags,
    'profile'::text AS source, true AS has_profile,
    (EXISTS (SELECT 1 FROM billing_customers bc WHERE lower(TRIM(BOTH FROM bc.email)) = lower(TRIM(BOTH FROM p.email)))) AS has_billing_customer,
    (SELECT a.account_number FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) AS account_number,
    (SELECT a.status FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) AS account_status
FROM profiles p
UNION
SELECT bc.id, bc.user_id, bc.email, (bc.first_name || ' ' || bc.last_name) AS full_name,
    bc.first_name, bc.last_name, bc.phone, bc.created_at,
    NULL::text AS client_number, NULL::text AS service_address, NULL::text AS service_city,
    NULL::text AS service_postal_code, NULL::text AS service_province, NULL::date AS date_of_birth,
    NULL::text[] AS sector_tags, 'billing'::text AS source,
    (EXISTS (SELECT 1 FROM profiles p WHERE lower(TRIM(BOTH FROM p.email)) = lower(TRIM(BOTH FROM bc.email)))) AS has_profile,
    true AS has_billing_customer, NULL::text AS account_number, NULL::text AS account_status
FROM billing_customers bc
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE lower(TRIM(BOTH FROM p.email)) = lower(TRIM(BOTH FROM bc.email)));

-- ============================================================
-- FIX 3: Quotes — restrict anon to valid checkout statuses only
-- ============================================================
DROP POLICY IF EXISTS "Public can read quotes by token" ON public.quotes;
CREATE POLICY "anon_read_quote_by_token" ON public.quotes
  FOR SELECT TO anon
  USING (
    public_token IS NOT NULL
    AND status IN ('sent', 'accepted', 'accepted_pending_checkout', 'checkout_completed')
  );
