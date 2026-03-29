-- Fix the test employee's role from 'client' to 'employee'
UPDATE public.user_roles 
SET role = 'employee', 
    can_access_core = false, 
    can_access_employee = true, 
    can_access_field = true,
    can_access_rh = true,
    require_onboarding = true
WHERE user_id = '9081648b-7eb0-4243-a41f-25875b97b7e6';