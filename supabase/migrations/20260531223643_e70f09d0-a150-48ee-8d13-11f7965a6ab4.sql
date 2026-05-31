
CREATE OR REPLACE FUNCTION public._agent_get_supplier_passwords(p_ids uuid[])
RETURNS TABLE(id uuid, password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := public._supplier_get_key();
  RETURN QUERY
  SELECT sa.id, pgp_sym_decrypt(sa.account_password_encrypted, v_key)::text
  FROM public.supplier_accounts sa
  WHERE sa.id = ANY(p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public._agent_get_supplier_passwords(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._agent_get_supplier_passwords(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public._agent_get_supplier_passwords(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._agent_get_supplier_passwords(uuid[]) TO service_role;
