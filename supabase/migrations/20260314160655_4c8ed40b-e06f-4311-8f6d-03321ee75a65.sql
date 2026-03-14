
-- Fix search_path on the 4 new functions
ALTER FUNCTION fn_auto_fail_stale_pending_payments() SET search_path = public;
ALTER FUNCTION fn_auto_fail_stale_payments_on_insert() SET search_path = public;
ALTER FUNCTION fn_validate_invoice_subscription_order_match() SET search_path = public;
ALTER FUNCTION fn_require_order_account_id() SET search_path = public;
