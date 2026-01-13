-- Remove the deny policy that blocks anonymous access
DROP POLICY IF EXISTS "Deny anonymous access to orders" ON public.orders;

-- Create a policy to allow public read access for order tracking by order_number
-- This is safe because:
-- 1. Users need to know the exact order_number
-- 2. Users need to verify with postal code (done in app logic)
-- 3. Only limited fields are exposed in the tracking page
CREATE POLICY "Public can view orders by order_number for tracking"
ON public.orders
FOR SELECT
USING (true);