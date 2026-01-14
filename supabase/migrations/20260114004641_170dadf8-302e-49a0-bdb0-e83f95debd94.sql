-- SECURITY: Remove overly-permissive public SELECT policy that exposes all orders to any authenticated user
DROP POLICY IF EXISTS "Public can view orders by order_number for tracking" ON public.orders;
