
CREATE OR REPLACE FUNCTION public.has_completed_hr_onboarding(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_records er
    WHERE er.user_id = _user_id
      AND er.status = 'active'
      AND er.onboarding_completed_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_completed_hr_onboarding(uuid) TO authenticated, service_role;
