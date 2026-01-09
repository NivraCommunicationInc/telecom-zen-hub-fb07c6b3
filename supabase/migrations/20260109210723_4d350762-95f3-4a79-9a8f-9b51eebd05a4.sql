-- Fix RLS policies for payment_methods to allow soft delete (setting deleted_at)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "client_select_own_payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "client_insert_own_payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "client_update_own_payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can view own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON public.payment_methods;

-- SELECT: Only active (non-deleted) cards belonging to user
CREATE POLICY "client_select_own_payment_methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND deleted_at IS NULL);

-- INSERT: Users can add their own cards
CREATE POLICY "client_insert_own_payment_methods"
ON public.payment_methods
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own cards (including soft delete via deleted_at)
-- IMPORTANT: No restriction on deleted_at in WITH CHECK to allow soft delete
CREATE POLICY "client_update_own_payment_methods"
ON public.payment_methods
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());