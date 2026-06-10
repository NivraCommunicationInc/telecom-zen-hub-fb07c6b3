REVOKE ALL ON FUNCTION public.sync_field_payment_links_from_field_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_field_payment_links_from_field_order() FROM anon;
REVOKE ALL ON FUNCTION public.sync_field_payment_links_from_field_order() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_field_payment_links_from_field_order() TO service_role;