-- CRITICAL FIX: Grant table permissions to authenticated and anon roles
-- Without these GRANT statements, RLS policies cannot function - queries fail with "permission denied"

-- Core tables used by client portal checkout
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.appointments TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.services TO authenticated;
GRANT SELECT ON public.tv_channels TO authenticated;
GRANT SELECT ON public.streaming_services TO authenticated;
GRANT SELECT ON public.channel_packages TO authenticated;
GRANT SELECT, INSERT ON public.channel_selections TO authenticated;
GRANT SELECT ON public.contracts TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.client_streaming_subscriptions TO authenticated;
GRANT SELECT ON public.accounts TO authenticated;
GRANT SELECT ON public.account_service_locations TO authenticated;
GRANT SELECT ON public.authorized_users TO authenticated;
GRANT INSERT ON public.authorized_users TO authenticated;

-- User roles table (needed for role checks)
GRANT SELECT ON public.user_roles TO authenticated;

-- System tables that need read access
GRANT SELECT ON public.site_settings TO authenticated;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT ON public.site_pages TO authenticated;
GRANT SELECT ON public.site_offers TO anon;
GRANT SELECT ON public.site_offers TO authenticated;
GRANT SELECT ON public.system_status TO authenticated;
GRANT SELECT ON public.system_status TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.tv_channels TO anon;
GRANT SELECT ON public.channel_packages TO anon;
GRANT SELECT ON public.streaming_services TO anon;
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT ON public.promotions TO authenticated;

-- Contact/application forms (anon can submit)
GRANT INSERT ON public.contact_requests TO anon;
GRANT INSERT ON public.job_applications TO anon;

-- Chatbot logs (authenticated can log)
GRANT INSERT ON public.chatbot_logs TO authenticated;
GRANT INSERT ON public.chatbot_logs TO anon;

-- Monthly invoices for client portal
GRANT SELECT ON public.monthly_invoices TO authenticated;
GRANT SELECT ON public.monthly_invoice_lines TO authenticated;

-- Replacement request tickets for client portal
GRANT SELECT, INSERT ON public.replacement_request_tickets TO authenticated;
GRANT SELECT ON public.replacement_internal_orders TO authenticated;