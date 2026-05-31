-- 1) has_staff_role(uuid) — enforce active staff
CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','employee','supervisor','support','billing_admin','kyc_agent','techops')
      AND is_active = true
      AND status = 'active'
  )
$function$;

-- 2) Restrict payroll_runs to payroll-authorized roles
DROP POLICY IF EXISTS "Staff read payroll runs" ON public.payroll_runs;
CREATE POLICY "Payroll staff read payroll runs"
ON public.payroll_runs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- 3) Restrict pay_periods
DROP POLICY IF EXISTS "Staff view pay periods" ON public.pay_periods;
CREATE POLICY "Payroll staff view pay periods"
ON public.pay_periods
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- 4) Restrict tax brackets
DROP POLICY IF EXISTS "Staff read federal brackets" ON public.tax_brackets_federal;
CREATE POLICY "Payroll staff read federal brackets"
ON public.tax_brackets_federal
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

DROP POLICY IF EXISTS "Staff read quebec brackets" ON public.tax_brackets_quebec;
CREATE POLICY "Payroll staff read quebec brackets"
ON public.tax_brackets_quebec
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- 5) Harden search_path on helper functions
CREATE OR REPLACE FUNCTION public.is_portal_projection_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(public.has_role(_user_id, 'admin'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'support'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'supervisor'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'billing_admin'::public.app_role), false)
      OR coalesce(public.has_role(_user_id, 'techops'::public.app_role), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_complaint_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.has_role(_uid,'admin')
      OR public.has_role(_uid,'employee')
      OR public.has_role(_uid,'field_sales')
$function$;