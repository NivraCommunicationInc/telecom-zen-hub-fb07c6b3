-- =====================================================
-- HARDENING: REVOKE EXECUTE for sensitive functions (correct signatures)
-- =====================================================

-- mark_payment_error_captured(uuid, text, uuid)
REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) TO service_role;

-- recover_error_captured_payment(uuid, text, uuid, text)
REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) TO service_role;

-- recompute_invoice_balance(uuid) - already done but ensure
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_invoice_balance(uuid) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.mark_payment_error_captured(uuid, text, uuid) IS 
'[P0 HARDENING] Marks a payment as error_captured. Only callable by service_role.';

COMMENT ON FUNCTION public.recover_error_captured_payment(uuid, text, uuid, text) IS 
'[P0 HARDENING] Recovers an error_captured payment via refund/credit. Only callable by service_role.';