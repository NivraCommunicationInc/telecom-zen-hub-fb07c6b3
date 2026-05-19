REVOKE ALL ON FUNCTION public.fn_check_portal_certification(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_check_portal_certification(UUID, TEXT) TO authenticated, service_role;