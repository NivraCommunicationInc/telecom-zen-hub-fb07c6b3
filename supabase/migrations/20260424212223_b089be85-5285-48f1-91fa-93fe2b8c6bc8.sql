UPDATE public.user_roles 
SET role = 'field_sales'
WHERE user_id IN (
  SELECT user_id FROM public.profiles
  WHERE full_name ILIKE '%diego%' OR email ILIKE '%diego%'
)
AND role = 'employee'
AND can_access_field = true;