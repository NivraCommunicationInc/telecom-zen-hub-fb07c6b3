
-- Ensure every client has a referral code (backfill + RPC to fetch/create on demand)

CREATE OR REPLACE FUNCTION public.ensure_client_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE owner_user_id = p_user_id
    AND COALESCE(code_type, 'client') = 'client'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generate_client_referral_code(p_user_id);

  INSERT INTO public.referral_codes (owner_user_id, code, status, code_type)
  VALUES (p_user_id, v_code, 'active', 'client')
  ON CONFLICT DO NOTHING;

  -- Re-read in case a concurrent insert won
  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE owner_user_id = p_user_id
    AND COALESCE(code_type, 'client') = 'client'
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_client_referral_code(uuid) TO authenticated;

-- Backfill: create a referral code for every existing client profile that lacks one
INSERT INTO public.referral_codes (owner_user_id, code, status, code_type)
SELECT p.user_id,
       public.generate_client_referral_code(p.user_id),
       'active',
       'client'
FROM public.profiles p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.referral_codes rc
    WHERE rc.owner_user_id = p.user_id
      AND COALESCE(rc.code_type, 'client') = 'client'
  );
