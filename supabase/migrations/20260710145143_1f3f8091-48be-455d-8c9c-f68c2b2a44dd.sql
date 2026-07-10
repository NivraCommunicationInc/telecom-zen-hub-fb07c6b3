
DROP FUNCTION IF EXISTS public.cron_expire_compensations();

CREATE OR REPLACE FUNCTION public.cron_expire_compensations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH expired AS (
    UPDATE public.account_adjustments
       SET status = 'expired'
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at < now()
       AND metadata ? 'compensation'
     RETURNING id
  )
  SELECT count(*) INTO n FROM expired;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_expire_compensations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_expire_compensations() TO service_role;
