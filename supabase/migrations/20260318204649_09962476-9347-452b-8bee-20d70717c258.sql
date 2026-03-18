-- =============================================================
-- FIX: Sync stale profiles.account_number to canonical accounts.account_number
-- INVARIANT: profiles.account_number must always mirror accounts.account_number
-- =============================================================

-- 1. Fix existing mismatches
UPDATE profiles p
SET account_number = a.account_number,
    updated_at = now()
FROM accounts a
WHERE a.client_id = p.user_id
  AND a.status = 'active'
  AND p.account_number IS DISTINCT FROM a.account_number;

-- 2. Create trigger to auto-sync profiles.account_number when accounts changes
CREATE OR REPLACE FUNCTION public.fn_sync_profile_account_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When account_number changes on accounts table, sync to profiles
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.account_number IS DISTINCT FROM NEW.account_number) THEN
    UPDATE profiles
    SET account_number = NEW.account_number,
        updated_at = now()
    WHERE user_id = NEW.client_id
      AND (account_number IS DISTINCT FROM NEW.account_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_account_number ON public.accounts;
CREATE TRIGGER trg_sync_profile_account_number
  AFTER INSERT OR UPDATE OF account_number ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_profile_account_number();

COMMENT ON FUNCTION public.fn_sync_profile_account_number() IS 
  'PERMANENT INVARIANT: Keeps profiles.account_number in sync with canonical accounts.account_number. Prevents stale data in portal displays.';