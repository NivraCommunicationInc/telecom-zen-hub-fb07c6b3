CREATE OR REPLACE FUNCTION public.detect_customer_portal_projection_divergences(_limit integer DEFAULT 2000)
RETURNS TABLE(user_id uuid, divergence_type text, severity text, details jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT p.user_id FROM public.profiles p WHERE p.user_id IS NOT NULL
    UNION SELECT a.client_id FROM public.accounts a WHERE a.client_id IS NOT NULL
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.user_id IS NOT NULL
    UNION SELECT o.user_id FROM public.orders o WHERE o.user_id IS NOT NULL
    UNION SELECT mi.client_id FROM public.monthly_invoices mi WHERE mi.client_id IS NOT NULL
    UNION SELECT p.user_id FROM public.payments p WHERE p.user_id IS NOT NULL
    UNION SELECT p.client_id FROM public.payments p WHERE p.client_id IS NOT NULL
    UNION SELECT st.user_id FROM public.support_tickets st WHERE st.user_id IS NOT NULL
    UNION SELECT st.owner_user_id FROM public.support_tickets st WHERE st.owner_user_id IS NOT NULL
    UNION SELECT ap.client_id FROM public.appointments ap WHERE ap.client_id IS NOT NULL
    UNION SELECT au.client_id FROM public.authorized_users au WHERE au.client_id IS NOT NULL
  ), limited AS (
    SELECT c.user_id FROM candidates c WHERE c.user_id IS NOT NULL LIMIT greatest(1, least(coalesce(_limit, 2000), 10000))
  ), assessed AS (
    SELECT l.user_id,
           s.last_refreshed_at,
           s.validation_status,
           s.portal_empty,
           s.core_has_data,
           s.section_counts,
           s.validation_errors,
           public.validate_customer_portal_snapshot(l.user_id, coalesce(s.snapshot, public.get_client_history_snapshot(l.user_id))) AS validation
    FROM limited l
    LEFT JOIN public.customer_portal_snapshots s ON s.user_id = l.user_id
  )
  SELECT a.user_id,
         CASE
           WHEN a.last_refreshed_at IS NULL THEN 'missing_projection'
           WHEN coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true THEN 'portal_empty_but_core_populated'
           WHEN coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'projection_validation_failed'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) THEN 'stale_snapshot'
           ELSE 'healthy'
         END AS divergence_type,
         CASE
           WHEN a.last_refreshed_at IS NULL OR (coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true) OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid' THEN 'critical'
           WHEN a.last_refreshed_at < now() - interval '5 minutes' THEN 'warning'
           ELSE 'info'
         END AS severity,
         jsonb_build_object(
           'lastRefreshedAt', a.last_refreshed_at,
           'sectionCounts', coalesce(a.section_counts, '{}'::jsonb),
           'validation', a.validation,
           'validationErrors', coalesce(a.validation_errors, '[]'::jsonb)
         ) AS details
  FROM assessed a
  WHERE a.last_refreshed_at IS NULL
     OR (coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false) = true AND coalesce((a.validation->>'portalEmpty')::boolean, a.portal_empty, true) = true)
     OR coalesce(a.validation->>'status', a.validation_status, 'invalid') <> 'valid'
     OR (a.last_refreshed_at < now() - interval '5 minutes' AND coalesce((a.validation->>'coreHasData')::boolean, a.core_has_data, false));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_customer_portal_projection_divergences(integer) TO service_role;