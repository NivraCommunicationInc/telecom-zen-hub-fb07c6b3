-- ==============================================================================
-- unified_clients view: add account_id so the admin list can use AccountStateBadge
-- ==============================================================================
-- Context: the legacy view only exposed account_number (text), which is fine
-- for display but useless for calling get_account_state(account_id uuid).
-- We add account_id alongside it. Existing consumers continue to work — only
-- a NEW column is appended (no renames or removals).
-- ==============================================================================

DROP VIEW IF EXISTS public.unified_clients;

CREATE VIEW public.unified_clients WITH (security_invoker = true) AS
SELECT
  p.id,
  p.user_id,
  p.email,
  p.full_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.created_at,
  p.client_number,
  p.service_address,
  p.service_city,
  p.service_postal_code,
  p.service_province,
  p.date_of_birth,
  p.sector_tags,
  'profile' AS source,
  TRUE AS has_profile,
  EXISTS (
    SELECT 1 FROM billing_customers bc
    WHERE lower(trim(bc.email)) = lower(trim(p.email))
  ) AS has_billing_customer,
  (SELECT a.account_number FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) AS account_number,
  -- NEW: expose the primary account_id so the frontend can call get_account_state()
  (SELECT a.id            FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) AS account_id,
  (SELECT a.status        FROM accounts a WHERE a.client_id = p.user_id ORDER BY a.created_at LIMIT 1) AS account_status
FROM profiles p
UNION
SELECT
  bc.id,
  bc.user_id,
  bc.email,
  bc.first_name || ' ' || bc.last_name AS full_name,
  bc.first_name,
  bc.last_name,
  bc.phone,
  bc.created_at,
  NULL AS client_number,
  NULL AS service_address,
  NULL AS service_city,
  NULL AS service_postal_code,
  NULL AS service_province,
  NULL AS date_of_birth,
  NULL AS sector_tags,
  'billing' AS source,
  EXISTS (
    SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = lower(trim(bc.email))
  ) AS has_profile,
  TRUE AS has_billing_customer,
  NULL AS account_number,
  NULL AS account_id,
  NULL AS account_status
FROM billing_customers bc
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = lower(trim(bc.email))
);

GRANT SELECT ON public.unified_clients TO authenticated;
GRANT SELECT ON public.unified_clients TO anon;
