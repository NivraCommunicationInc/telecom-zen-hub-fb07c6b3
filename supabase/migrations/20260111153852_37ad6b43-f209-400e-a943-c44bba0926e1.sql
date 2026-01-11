-- CLEANUP: Remove temporary test functions
DROP FUNCTION IF EXISTS public.get_current_context();
DROP FUNCTION IF EXISTS public.test_paid_invoice_bypass_proof(uuid);