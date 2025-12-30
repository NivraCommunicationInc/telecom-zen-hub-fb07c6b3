-- Deny anonymous access to sensitive tables
-- These policies explicitly block any anonymous (unauthenticated) access

-- Profiles: Deny all anonymous access
CREATE POLICY "Deny anonymous access to profiles" ON public.profiles
FOR ALL TO anon USING (false);

-- Billing: Deny all anonymous access  
CREATE POLICY "Deny anonymous access to billing" ON public.billing
FOR ALL TO anon USING (false);

-- Orders: Deny all anonymous access
CREATE POLICY "Deny anonymous access to orders" ON public.orders
FOR ALL TO anon USING (false);

-- Messages: Deny all anonymous access
CREATE POLICY "Deny anonymous access to messages" ON public.messages
FOR ALL TO anon USING (false);

-- Client Documents: Deny all anonymous access
CREATE POLICY "Deny anonymous access to client_documents" ON public.client_documents
FOR ALL TO anon USING (false);

-- Contracts: Deny all anonymous access
CREATE POLICY "Deny anonymous access to contracts" ON public.contracts
FOR ALL TO anon USING (false);

-- Contact Requests: Deny anonymous SELECT/UPDATE/DELETE but keep INSERT for public form
CREATE POLICY "Deny anonymous read on contact_requests" ON public.contact_requests
FOR SELECT TO anon USING (false);

CREATE POLICY "Deny anonymous update on contact_requests" ON public.contact_requests
FOR UPDATE TO anon USING (false);

CREATE POLICY "Deny anonymous delete on contact_requests" ON public.contact_requests
FOR DELETE TO anon USING (false);