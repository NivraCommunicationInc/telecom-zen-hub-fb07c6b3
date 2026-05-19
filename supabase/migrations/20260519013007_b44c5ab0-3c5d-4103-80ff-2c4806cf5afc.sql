
REVOKE EXECUTE ON FUNCTION public.crm_lock_contact(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_unlock_contact(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_log_call(uuid, text, text, timestamptz, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_auto_unlock_expired() FROM anon, public;
