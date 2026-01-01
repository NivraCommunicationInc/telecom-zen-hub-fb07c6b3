-- Add RLS policy to allow clients to insert billing records for their own orders
CREATE POLICY "Users can create their own billing records"
ON public.billing
FOR INSERT
WITH CHECK (auth.uid() = user_id);