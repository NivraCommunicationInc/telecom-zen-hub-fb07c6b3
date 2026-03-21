-- ============================================================
-- FIX 1: PRIVILEGE ESCALATION — Remove dangerous INSERT policy
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- ============================================================
-- FIX 2: has_role() missing is_active/status check
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND status = 'active'
  )
$$;

-- ============================================================
-- FIX 3: equipment_inventory — replace wide-open policy
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage equipment inventory" ON public.equipment_inventory;

CREATE POLICY "Admin/employee can manage equipment"
ON public.equipment_inventory FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);

-- ============================================================
-- FIX 4: SECURITY DEFINER views — set security_invoker
-- ============================================================
ALTER VIEW public.client_payment_history SET (security_invoker = true);
ALTER VIEW public.client_unpaid_invoices SET (security_invoker = true);
ALTER VIEW public.unified_clients SET (security_invoker = true);
ALTER VIEW public.payment_requests_admin_view SET (security_invoker = true);
ALTER VIEW public.field_sales_leaderboard SET (security_invoker = true);
ALTER VIEW public.order_next_actions SET (security_invoker = true);
ALTER VIEW public.tickets SET (security_invoker = true);
ALTER VIEW public.influencer_invites_public SET (security_invoker = true);
ALTER VIEW public.qa_cron_jobs SET (security_invoker = true);
ALTER VIEW public.qa_document_sources SET (security_invoker = true);
ALTER VIEW public.qa_orphaned_payments SET (security_invoker = true);
ALTER VIEW public.qa_payments_without_client SET (security_invoker = true);
ALTER VIEW public.qa_pdf_generation_logs SET (security_invoker = true);
ALTER VIEW public.qa_pdf_templates_runtime SET (security_invoker = true);
ALTER VIEW public.services_public SET (security_invoker = true);
ALTER VIEW public.site_offers_public SET (security_invoker = true);
ALTER VIEW public.site_settings_public SET (security_invoker = true);
ALTER VIEW public.streaming_catalog_public SET (security_invoker = true);
ALTER VIEW public.tv_channels_public SET (security_invoker = true);