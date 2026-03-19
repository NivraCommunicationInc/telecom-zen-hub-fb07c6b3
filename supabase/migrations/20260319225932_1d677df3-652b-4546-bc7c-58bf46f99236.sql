UPDATE public.user_roles 
SET role = 'admin', 
    can_access_core = true, 
    can_access_employee = true, 
    can_access_field = true, 
    can_access_technician = true,
    mfa_required = true,
    status = 'active',
    is_active = true
WHERE user_id = 'c4cffc88-af6b-4205-8323-599b8794611a';