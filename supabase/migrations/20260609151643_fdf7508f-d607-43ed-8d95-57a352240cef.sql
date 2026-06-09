REVOKE EXECUTE ON FUNCTION public.sync_field_payment_intent_converted_order() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_field_payment_intent_converted_order() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_field_payment_intent_converted_order() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_field_payment_intent_converted_order() TO service_role;