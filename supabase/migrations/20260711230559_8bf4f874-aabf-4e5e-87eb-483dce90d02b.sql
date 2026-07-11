-- Module 51 — Phase B1
-- Enforce security_invoker so RLS of underlying tables applies to timeline reads,
-- and remove anonymous SELECT access on the view.

ALTER VIEW public.v_customer_timeline SET (security_invoker = on);

REVOKE SELECT ON public.v_customer_timeline FROM anon;

-- Keep authenticated + service_role intact
GRANT SELECT ON public.v_customer_timeline TO authenticated;
GRANT SELECT ON public.v_customer_timeline TO service_role;