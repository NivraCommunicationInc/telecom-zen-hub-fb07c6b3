
ALTER TABLE public.core_settings
  ADD COLUMN IF NOT EXISTS kyc_auto_approve boolean NOT NULL DEFAULT true;
UPDATE public.core_settings SET kyc_auto_approve = true;

CREATE OR REPLACE FUNCTION public.is_kyc_auto_approve_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT kyc_auto_approve FROM public.core_settings LIMIT 1), false); $$;

CREATE OR REPLACE FUNCTION public.auto_approve_kyc_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client_id uuid;
BEGIN
  IF NOT public.is_kyc_auto_approve_enabled() THEN RETURN NEW; END IF;
  v_client_id := NEW.user_id;

  NEW.kyc_status := 'approved';
  IF NEW.kyc_policy IS NULL OR NEW.kyc_policy NOT IN ('none','skip') THEN
    NEW.kyc_policy := 'skip';
  END IF;
  NEW.require_fresh_kyc := false;

  UPDATE public.kyc_verifications
     SET status = 'verified', reviewed_at = COALESCE(reviewed_at, now())
   WHERE client_id = v_client_id
     AND status IN ('pending','in_review','submitted');

  UPDATE public.kyc_requests
     SET status = 'approved', approved_at = COALESCE(approved_at, now())
   WHERE client_id = v_client_id
     AND status IN ('pending','in_review','submitted','requested');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_approve_kyc_on_order ON public.orders;
CREATE TRIGGER trg_auto_approve_kyc_on_order
BEFORE INSERT OR UPDATE OF status, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_kyc_on_order();

UPDATE public.kyc_verifications kv
   SET status = 'verified', reviewed_at = COALESCE(kv.reviewed_at, now())
 WHERE kv.status IN ('pending','in_review','submitted')
   AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = kv.client_id);

UPDATE public.kyc_requests kr
   SET status = 'approved', approved_at = COALESCE(kr.approved_at, now())
 WHERE kr.status IN ('pending','in_review','submitted','requested')
   AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = kr.client_id);

UPDATE public.orders
   SET kyc_status = 'approved',
       kyc_policy = CASE WHEN kyc_policy IN ('none','skip') THEN kyc_policy ELSE 'skip' END,
       require_fresh_kyc = false
 WHERE kyc_status IS DISTINCT FROM 'approved';
