-- Revoke all implicit execute permissions
REVOKE EXECUTE ON FUNCTION public.get_db_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.test_bypass_update(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_db_context() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_db_context() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.test_bypass_update(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_bypass_update(uuid) FROM authenticated;

-- Drop test functions - zero attack surface
DROP FUNCTION IF EXISTS public.test_bypass_update(uuid);
DROP FUNCTION IF EXISTS public.get_db_context();