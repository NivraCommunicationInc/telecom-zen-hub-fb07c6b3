CREATE OR REPLACE FUNCTION public.list_active_technicians_for_mobile()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.full_name, t.email, t.status
  FROM public.technicians t
  WHERE auth.uid() IS NOT NULL
    AND lower(coalesce(t.status, '')) = 'active'
  ORDER BY t.full_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_technician_mobile_self(p_selected_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  status text,
  specializations text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS auth_user_id,
           auth.jwt() ->> 'email' AS auth_email
  )
  SELECT x.id, x.user_id, x.full_name, x.email, x.phone, x.status, x.specializations
  FROM (
    SELECT t.id, t.user_id, t.full_name, t.email, t.phone, t.status, t.specializations, 1 AS priority
    FROM public.technicians t
    CROSS JOIN me
    WHERE me.auth_user_id IS NOT NULL
      AND t.user_id = me.auth_user_id

    UNION ALL

    SELECT t.id, t.user_id, t.full_name, t.email, t.phone, t.status, t.specializations, 2 AS priority
    FROM public.technicians t
    CROSS JOIN me
    WHERE me.auth_user_id IS NOT NULL
      AND me.auth_email IS NOT NULL
      AND lower(coalesce(t.email, '')) = lower(me.auth_email)

    UNION ALL

    SELECT t.id, t.user_id, t.full_name, t.email, t.phone, t.status, t.specializations, 3 AS priority
    FROM public.technicians t
    CROSS JOIN me
    WHERE me.auth_user_id IS NOT NULL
      AND p_selected_id IS NOT NULL
      AND t.id = p_selected_id
  ) x
  ORDER BY x.priority
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.list_active_technicians_for_mobile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_technician_mobile_self(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_technicians_for_mobile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_technician_mobile_self(uuid) TO authenticated;