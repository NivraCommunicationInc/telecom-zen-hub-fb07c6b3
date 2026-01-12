-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.is_influencer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.influencers
    WHERE user_id = _user_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_influencer_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.influencers
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.generate_cashout_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.request_number := 'CR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(COUNT(*) + 1, 1)::TEXT FROM public.cashout_requests 
     WHERE created_at::date = CURRENT_DATE), 4, '0');
  RETURN NEW;
END;
$$;