CREATE OR REPLACE FUNCTION public.validate_active_staff_impersonation(
  _session_id uuid,
  _target_user_id uuid,
  _portal text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_impersonation_sessions s
    WHERE s.id = _session_id
      AND s.target_user_id = _target_user_id
      AND s.portal = _portal
      AND s.is_active = true
      AND s.expires_at > now()
      AND s.consumed_at IS NOT NULL
      AND s.ended_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.validate_active_staff_impersonation(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_active_staff_impersonation(uuid, uuid, text) TO authenticated;