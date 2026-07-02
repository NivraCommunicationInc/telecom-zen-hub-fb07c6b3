
-- Fix 1: Re-grant execute on public payment intent lookup (was returning permission denied for anon)
GRANT EXECUTE ON FUNCTION public.get_field_payment_intent_public(uuid) TO anon, authenticated;

-- Fix 2: has_role must ignore deactivated / non-active role rows
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
      and coalesce(is_active, true) = true
      and coalesce(status, 'active') = 'active'
  )
$function$;
