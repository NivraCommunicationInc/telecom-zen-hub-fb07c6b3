-- Fix the policy creation syntax error

-- Only admins can view deprecated payment methods for audit purposes
DROP POLICY IF EXISTS "Only admins can view deprecated payment methods" ON public.payment_methods;

CREATE POLICY "Only admins can view deprecated payment methods"
ON public.payment_methods
FOR SELECT
USING (is_admin());