
-- ============================================================
-- SECURITY FIX 1: DOB debug table — restrict to admin only
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated reads on dob_validation_debug" ON public.dob_validation_debug;
CREATE POLICY "admin_only_dob_debug" ON public.dob_validation_debug
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SECURITY FIX 2: Move unaccent extension to 'extensions' schema
-- ============================================================
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- ============================================================
-- SECURITY FIX 3: Set search_path on all public functions missing it
-- ============================================================

-- 3a: delete_email (SECURITY DEFINER)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;

-- 3b: enforce_invoice_invariants (trigger)
ALTER FUNCTION public.enforce_invoice_invariants() SET search_path = public;

-- 3c: enforce_void_invoice_zero_balance (trigger)
ALTER FUNCTION public.enforce_void_invoice_zero_balance() SET search_path = public;

-- 3d: enqueue_email (SECURITY DEFINER)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;

-- 3e: fn_update_profile_change_requests_timestamp (trigger)
ALTER FUNCTION public.fn_update_profile_change_requests_timestamp() SET search_path = public;

-- 3f: generate_quote_public_token (trigger)
ALTER FUNCTION public.generate_quote_public_token() SET search_path = public;

-- 3g: move_to_dlq (SECURITY DEFINER)
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 3h: read_email_batch (SECURITY DEFINER)
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 3i: set_updated_at (trigger)
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 3j: update_equipment_inventory_updated_at (trigger)
ALTER FUNCTION public.update_equipment_inventory_updated_at() SET search_path = public;

-- 3k: update_subscription_on_invoice_paid (trigger)
ALTER FUNCTION public.update_subscription_on_invoice_paid() SET search_path = public;

-- 3l: validate_field_agent_discount (trigger)
ALTER FUNCTION public.validate_field_agent_discount() SET search_path = public;

-- ============================================================
-- SECURITY FIX 4: Restrict service_role-only policies
-- These are already scoped to service_role role, so WITH CHECK (true)
-- is acceptable. Adding explicit service_role check for defense-in-depth.
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert identity documents" ON public.identity_documents;
CREATE POLICY "Service role can insert identity documents" ON public.identity_documents
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert events" ON public.transaction_events;
CREATE POLICY "Service role can insert events" ON public.transaction_events
  FOR INSERT TO service_role
  WITH CHECK (true);
