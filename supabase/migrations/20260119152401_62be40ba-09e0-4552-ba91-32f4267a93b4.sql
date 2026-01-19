-- Fix PUBLIC_REFERRAL_CODES exposure
-- The current "Public can validate codes" policy exposes too much data

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can validate codes" ON public.referral_codes;

-- Create a restricted view for public code validation (only code and status)
CREATE OR REPLACE VIEW public.referral_codes_public AS
SELECT 
  id,
  code,
  status
FROM public.referral_codes
WHERE status = 'active';

-- Enable RLS on the view is not needed - views inherit from base table
-- Grant select on the view to anon and authenticated
GRANT SELECT ON public.referral_codes_public TO anon;
GRANT SELECT ON public.referral_codes_public TO authenticated;

-- Create a security definer function for public code validation
-- This allows validating a code without exposing the full table
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  code_id UUID,
  discount_percent NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE AS is_valid,
    rc.id AS code_id,
    rc.discount_percent
  FROM referral_codes rc
  WHERE rc.code = UPPER(p_code)
    AND rc.status = 'active'
    AND (rc.usage_limit_total IS NULL OR rc.usage_count < rc.usage_limit_total)
  LIMIT 1;
  
  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE AS is_valid, NULL::UUID AS code_id, NULL::NUMERIC AS discount_percent;
  END IF;
END;
$$;

-- Grant execute to public users
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;