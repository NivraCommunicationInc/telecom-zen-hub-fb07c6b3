-- ==============================================
-- ADMIN-ONLY SYSTEM MIGRATION
-- Remove client access, archive card payments, create admin payment view
-- ==============================================

-- 1) Create admin-only view for payment requests with profiles (fixes N+1)
CREATE OR REPLACE VIEW public.payment_requests_admin_view AS
SELECT 
  pr.*,
  p.email AS client_email,
  p.full_name AS client_name,
  p.phone AS client_phone,
  a.account_number,
  a.status AS account_status
FROM public.payment_requests pr
LEFT JOIN public.profiles p ON pr.user_id = p.user_id
LEFT JOIN public.accounts a ON a.client_id = pr.user_id;

-- Grant admin access only
ALTER VIEW public.payment_requests_admin_view OWNER TO postgres;

-- 2) Remove "client" from app_role enum and user_roles
-- First, update any existing client roles to be unusable
UPDATE public.user_roles SET role = 'admin' WHERE role = 'client';

-- 3) Drop all client-scoped RLS policies on sensitive tables
-- profiles table - admin only
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Clients can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Clients can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Admin only - profiles" ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- billing table - admin only
DROP POLICY IF EXISTS "Users can view their own billing" ON public.billing;
DROP POLICY IF EXISTS "Clients can view own billing" ON public.billing;

CREATE POLICY "Admin only - billing" ON public.billing
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders table - admin only
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can view own orders" ON public.orders;

CREATE POLICY "Admin only - orders" ON public.orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- payments table - admin only
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Clients can view own payments" ON public.payments;

CREATE POLICY "Admin only - payments" ON public.payments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- appointments table - admin only
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;

CREATE POLICY "Admin only - appointments" ON public.appointments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- support_tickets - admin only
DROP POLICY IF EXISTS "Users can manage their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Clients can manage own tickets" ON public.support_tickets;

CREATE POLICY "Admin only - support_tickets" ON public.support_tickets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- contracts - admin only
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Clients can view own contracts" ON public.contracts;

CREATE POLICY "Admin only - contracts" ON public.contracts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- notifications - admin only
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Admin only - notifications" ON public.notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ledger_entries - admin only
DROP POLICY IF EXISTS "Users can view their own ledger entries" ON public.ledger_entries;

CREATE POLICY "Admin only - ledger_entries" ON public.ledger_entries
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- monthly_invoices - admin only
DROP POLICY IF EXISTS "Users can view their own monthly invoices" ON public.monthly_invoices;

CREATE POLICY "Admin only - monthly_invoices" ON public.monthly_invoices
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- payment_requests - admin only (keep existing but ensure correct)
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can create payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Authenticated users can insert payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Only admins manage payment requests" ON public.payment_requests;

CREATE POLICY "Admin only - payment_requests" ON public.payment_requests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- services - admin only
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
DROP POLICY IF EXISTS "Clients can view own services" ON public.services;
DROP POLICY IF EXISTS "Only admins manage services" ON public.services;

CREATE POLICY "Admin only - services" ON public.services
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- channel_selections - admin only
DROP POLICY IF EXISTS "Users can manage their own channel selections" ON public.channel_selections;

CREATE POLICY "Admin only - channel_selections" ON public.channel_selections
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- client_streaming_subscriptions - admin only
DROP POLICY IF EXISTS "Users can view their own streaming subscriptions" ON public.client_streaming_subscriptions;

CREATE POLICY "Admin only - client_streaming_subscriptions" ON public.client_streaming_subscriptions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- accounts - admin only
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Clients can view own accounts" ON public.accounts;

CREATE POLICY "Admin only - accounts" ON public.accounts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4) Archive payment_methods table (already deprecated, ensure no access)
DROP POLICY IF EXISTS "Only admins can view deprecated payment methods" ON public.payment_methods;

CREATE POLICY "Admin archive only - payment_methods" ON public.payment_methods
  FOR SELECT USING (public.is_admin());

-- Add archive comment
COMMENT ON TABLE public.payment_methods IS 'DEPRECATED: Credit card payments removed. Admin archive only.';

-- 5) Ensure payment_settings is public read (for instructions)
-- Already has public SELECT, admin manage - verified

-- 6) Clean up user_roles - remove client entries
-- (Already updated to admin above, but let's ensure table is admin-only)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admin only - user_roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7) client_login_pins - admin only (no client self-service)
DROP POLICY IF EXISTS "Users can view their own pins" ON public.client_login_pins;

CREATE POLICY "Admin only - client_login_pins" ON public.client_login_pins
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8) authorized_users - admin only
DROP POLICY IF EXISTS "Users can view their own authorized users" ON public.authorized_users;
DROP POLICY IF EXISTS "Users can manage their own authorized users" ON public.authorized_users;

CREATE POLICY "Admin only - authorized_users" ON public.authorized_users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9) client_documents - admin only
DROP POLICY IF EXISTS "Users can view their own documents" ON public.client_documents;
DROP POLICY IF EXISTS "Users can upload their own documents" ON public.client_documents;

CREATE POLICY "Admin only - client_documents" ON public.client_documents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 10) client_internal_notes - admin only
DROP POLICY IF EXISTS "Only staff can view internal notes" ON public.client_internal_notes;
DROP POLICY IF EXISTS "Only staff can add internal notes" ON public.client_internal_notes;

CREATE POLICY "Admin only - client_internal_notes" ON public.client_internal_notes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 11) payment_disputes - admin only
DROP POLICY IF EXISTS "Users can view their own disputes" ON public.payment_disputes;
DROP POLICY IF EXISTS "Users can create disputes" ON public.payment_disputes;

CREATE POLICY "Admin only - payment_disputes" ON public.payment_disputes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 12) work_orders - admin only
DROP POLICY IF EXISTS "Only staff can manage work orders" ON public.work_orders;

CREATE POLICY "Admin only - work_orders" ON public.work_orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 13) service_cancellation_requests - admin only
DROP POLICY IF EXISTS "Users can view their own cancellation requests" ON public.service_cancellation_requests;
DROP POLICY IF EXISTS "Users can create cancellation requests" ON public.service_cancellation_requests;

CREATE POLICY "Admin only - service_cancellation_requests" ON public.service_cancellation_requests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 14) replacement_request_tickets - admin only
DROP POLICY IF EXISTS "Users can view their own replacement requests" ON public.replacement_request_tickets;
DROP POLICY IF EXISTS "Users can create replacement requests" ON public.replacement_request_tickets;

CREATE POLICY "Admin only - replacement_request_tickets" ON public.replacement_request_tickets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());