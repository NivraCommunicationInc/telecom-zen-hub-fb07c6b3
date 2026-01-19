-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

-- Ensure the is_admin() based policy has proper with_check for UPDATE
DROP POLICY IF EXISTS "Admin only - services" ON public.services;

-- Create a single clear policy for admin management
CREATE POLICY "Admins can fully manage services"
ON public.services
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Ensure public read policy remains
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
USING (is_active = true);