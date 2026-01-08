-- ============================================
-- CRITICAL FIX: Complete the anon deny policies for all sensitive tables
-- ============================================

-- profiles: Block anon access
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles FOR ALL TO anon USING (false);

-- accounts: Block anon access
CREATE POLICY "Deny anonymous access to accounts" 
ON public.accounts FOR ALL TO anon USING (false);

-- appointments: Block anon access
CREATE POLICY "Deny anonymous access to appointments" 
ON public.appointments FOR ALL TO anon USING (false);

-- authorized_users: Block anon access
CREATE POLICY "Deny anonymous access to authorized_users" 
ON public.authorized_users FOR ALL TO anon USING (false);

-- support_tickets: Block anon access
CREATE POLICY "Deny anonymous access to support_tickets" 
ON public.support_tickets FOR ALL TO anon USING (false);

-- payment_methods: Block anon access
CREATE POLICY "Deny anonymous access to payment_methods" 
ON public.payment_methods FOR ALL TO anon USING (false);

-- subscriptions: Block anon access
CREATE POLICY "Deny anonymous access to subscriptions" 
ON public.subscriptions FOR ALL TO anon USING (false);

-- monthly_invoices: Block anon access
CREATE POLICY "Deny anonymous access to monthly_invoices" 
ON public.monthly_invoices FOR ALL TO anon USING (false);

-- work_orders: Block anon access
CREATE POLICY "Deny anonymous access to work_orders" 
ON public.work_orders FOR ALL TO anon USING (false);

-- employees: Block anon access
CREATE POLICY "Deny anonymous access to employees" 
ON public.employees FOR ALL TO anon USING (false);

-- technicians: Block anon access
CREATE POLICY "Deny anonymous access to technicians" 
ON public.technicians FOR ALL TO anon USING (false);

-- replacement_internal_orders: Block anon access
CREATE POLICY "Deny anonymous access to replacement_orders" 
ON public.replacement_internal_orders FOR ALL TO anon USING (false);

-- replacement_request_tickets: Block anon access
CREATE POLICY "Deny anonymous access to replacement_tickets" 
ON public.replacement_request_tickets FOR ALL TO anon USING (false);

-- account_service_locations: Block anon access
CREATE POLICY "Deny anonymous access to service_locations" 
ON public.account_service_locations FOR ALL TO anon USING (false);

-- client_streaming_subscriptions: Block anon access
CREATE POLICY "Deny anonymous access to streaming_subscriptions" 
ON public.client_streaming_subscriptions FOR ALL TO anon USING (false);

-- activity_logs: Block anon access
CREATE POLICY "Deny anonymous access to activity_logs" 
ON public.activity_logs FOR ALL TO anon USING (false);

-- ledger_entries: Block anon access
CREATE POLICY "Deny anonymous access to ledger" 
ON public.ledger_entries FOR ALL TO anon USING (false);