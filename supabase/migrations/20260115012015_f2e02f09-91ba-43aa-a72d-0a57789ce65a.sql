-- Add policy to allow clients to insert their own referral attributions during checkout
CREATE POLICY "Clients can insert own referral attributions"
ON public.referral_attributions
FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid());

-- Also allow clients to read their own attributions (as customer)
CREATE POLICY "Clients can view their own referral usage"
ON public.referral_attributions
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());