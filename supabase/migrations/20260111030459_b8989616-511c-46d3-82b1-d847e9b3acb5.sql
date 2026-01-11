
-- Fix search_path pour les fonctions SECURITY DEFINER
ALTER FUNCTION protect_paid_invoice() SET search_path = public;
ALTER FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) SET search_path = public;
ALTER FUNCTION recompute_invoice_balance(UUID) SET search_path = public;
ALTER FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) SET search_path = public;
ALTER FUNCTION validate_payment_created_by() SET search_path = public;
