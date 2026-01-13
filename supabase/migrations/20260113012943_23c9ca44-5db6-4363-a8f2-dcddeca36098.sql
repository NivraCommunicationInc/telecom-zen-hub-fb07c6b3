-- Create function to increment referral code usage count
CREATE OR REPLACE FUNCTION public.increment_referral_usage(code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = now()
  WHERE id = code_id;
END;
$$;