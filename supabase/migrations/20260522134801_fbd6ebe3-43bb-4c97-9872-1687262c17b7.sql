CREATE OR REPLACE FUNCTION public.core_get_agent_tracking(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  mfa_enrolled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.last_sign_in_at,
    u.email_confirmed_at,
    EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = u.id AND f.status = 'verified'
    ) AS mfa_enrolled
  FROM auth.users u
  WHERE u.id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.core_get_agent_tracking(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_get_agent_tracking(uuid[]) TO authenticated;