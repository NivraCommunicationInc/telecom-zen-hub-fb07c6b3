
-- =====================================================
-- SECURITY HARDENING: Remove public access policies
-- =====================================================

-- 1) FORCE RLS on all tables for deny-by-default posture
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_invoice_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.technicians FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tv_channels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.telecom_analytics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_files FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_updates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.internal_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_replies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.account_service_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_access_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_pin_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.security_action_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_selections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promotions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_request_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_internal_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_timeline FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_streaming_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.request_replies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- 2) Remove "Anyone can view" policies - these allow unauthenticated/any access
DROP POLICY IF EXISTS "Anyone can view service status" ON public.service_status;
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view active streaming services" ON public.streaming_services;
DROP POLICY IF EXISTS "Anyone can view active system status" ON public.system_status;

-- 3) Add staff-only policy for service_status (network infrastructure)
CREATE POLICY "Staff can view service status"
ON public.service_status
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);

-- 4) Add authenticated-only policy for services (clients can see active only)
CREATE POLICY "Authenticated users can view active services"
ON public.services
FOR SELECT
TO authenticated
USING (is_active = true);

-- 5) Add authenticated-only policy for streaming_services
CREATE POLICY "Authenticated users can view active streaming services"
ON public.streaming_services
FOR SELECT
TO authenticated
USING (is_active = true);

-- 6) Add authenticated-only policy for system_status (clients see public announcements)
CREATE POLICY "Authenticated users can view public system status"
ON public.system_status
FOR SELECT
TO authenticated
USING (is_active = true AND show_to_clients = true);

-- 7) Add staff-only policy for telecom_analytics
CREATE POLICY "Staff can view all telecom analytics"
ON public.telecom_analytics
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role)
);
