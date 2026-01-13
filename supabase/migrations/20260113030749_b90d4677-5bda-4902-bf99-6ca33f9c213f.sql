-- Add public read policy for referral_program_settings (non-sensitive settings)
CREATE POLICY "Anyone can read program settings" 
ON public.referral_program_settings
FOR SELECT
TO authenticated
USING (true);