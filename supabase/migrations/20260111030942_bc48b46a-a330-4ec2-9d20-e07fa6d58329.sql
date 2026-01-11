
-- Révoquer accès anon sur les fonctions sensibles
REVOKE EXECUTE ON FUNCTION recompute_invoice_balance(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) FROM anon;
