-- Explicit lockdown policy: deny everything to all roles
-- Only SECURITY DEFINER functions (which bypass RLS) can read this table
CREATE POLICY "supplier_secrets_no_access" ON public.supplier_secrets
  FOR ALL USING (false) WITH CHECK (false);