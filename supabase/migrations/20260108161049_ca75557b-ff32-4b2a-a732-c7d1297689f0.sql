-- ============================================
-- CRITICAL FIX: Block anonymous access - remaining ledger tables
-- ============================================

-- ledger_invoice_allocations: Block anon access
DROP POLICY IF EXISTS "Deny anonymous access to allocations" ON public.ledger_invoice_allocations;
CREATE POLICY "Deny anonymous access to allocations" 
ON public.ledger_invoice_allocations 
FOR ALL 
TO anon
USING (false);