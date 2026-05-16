CREATE OR REPLACE FUNCTION public.is_field_sales(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'field_sales'
      AND is_active = true
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_marketing_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','supervisor','employee','billing_admin')
      AND is_active = true
      AND status = 'active'
  )
$$;

UPDATE public.billing_invoice_lines
SET description = 'Rabais 25$/mois — 12 mois'
WHERE line_type = 'discount'
  AND description LIKE 'Rabais 25$/mois — 12 mois — %';