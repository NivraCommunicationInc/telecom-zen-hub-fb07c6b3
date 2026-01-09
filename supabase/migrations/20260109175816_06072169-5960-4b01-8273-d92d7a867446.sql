-- Add SELECT policy for clients to read their own orders
-- This is required because the checkout uses .upsert().select().single()
-- and the client needs to be able to read the order after insertion

CREATE POLICY "Clients can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Also add UPDATE policy for clients on their own draft/pending orders
-- This allows clients to modify their order before confirmation
CREATE POLICY "Clients can update their own pending orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('draft', 'pending'))
WITH CHECK (auth.uid() = user_id AND status IN ('draft', 'pending'));