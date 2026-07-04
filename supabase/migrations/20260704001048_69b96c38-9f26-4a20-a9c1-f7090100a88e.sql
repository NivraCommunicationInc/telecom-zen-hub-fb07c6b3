
-- Helper: detect any staff role (non-client)
CREATE OR REPLACE FUNCTION public.is_staff_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','employee','technician','field_sales','sales','kyc_agent',
                   'billing_admin','techops','support','supervisor','ops')
  )
$$;

-- ============================================================
-- profiles: block clients from tampering with privileged fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_profiles_client_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff / service role bypass entirely
  IF auth.uid() IS NULL OR public.is_staff_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Client-only path: reject changes to any privileged column
  IF NEW.balance          IS DISTINCT FROM OLD.balance          THEN RAISE EXCEPTION 'not allowed: balance'; END IF;
  IF NEW.store_credit     IS DISTINCT FROM OLD.store_credit     THEN RAISE EXCEPTION 'not allowed: store_credit'; END IF;
  IF NEW.security_status  IS DISTINCT FROM OLD.security_status  THEN RAISE EXCEPTION 'not allowed: security_status'; END IF;
  IF NEW.security_reason  IS DISTINCT FROM OLD.security_reason  THEN RAISE EXCEPTION 'not allowed: security_reason'; END IF;
  IF NEW.account_status   IS DISTINCT FROM OLD.account_status   THEN RAISE EXCEPTION 'not allowed: account_status'; END IF;
  IF NEW.client_pin_hash  IS DISTINCT FROM OLD.client_pin_hash  THEN RAISE EXCEPTION 'not allowed: client_pin_hash'; END IF;
  IF NEW.pin_is_default   IS DISTINCT FROM OLD.pin_is_default   THEN RAISE EXCEPTION 'not allowed: pin_is_default'; END IF;
  IF NEW.employment_type  IS DISTINCT FROM OLD.employment_type  THEN RAISE EXCEPTION 'not allowed: employment_type'; END IF;
  IF NEW.base_salary      IS DISTINCT FROM OLD.base_salary      THEN RAISE EXCEPTION 'not allowed: base_salary'; END IF;
  IF NEW.hourly_rate      IS DISTINCT FROM OLD.hourly_rate      THEN RAISE EXCEPTION 'not allowed: hourly_rate'; END IF;
  IF NEW.commission_rate  IS DISTINCT FROM OLD.commission_rate  THEN RAISE EXCEPTION 'not allowed: commission_rate'; END IF;
  IF NEW.identity_verified IS DISTINCT FROM OLD.identity_verified THEN RAISE EXCEPTION 'not allowed: identity_verified'; END IF;
  IF NEW.user_id          IS DISTINCT FROM OLD.user_id          THEN RAISE EXCEPTION 'not allowed: user_id'; END IF;
  IF NEW.id               IS DISTINCT FROM OLD.id               THEN RAISE EXCEPTION 'not allowed: id'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profiles_client_safe_update_trg ON public.profiles;
CREATE TRIGGER enforce_profiles_client_safe_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profiles_client_safe_update();

-- ============================================================
-- accounts: block clients from tampering with privileged fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_accounts_client_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.credit_class      IS DISTINCT FROM OLD.credit_class      THEN RAISE EXCEPTION 'not allowed: credit_class'; END IF;
  IF NEW.status            IS DISTINCT FROM OLD.status            THEN RAISE EXCEPTION 'not allowed: status'; END IF;
  IF NEW.billing_cycle_day IS DISTINCT FROM OLD.billing_cycle_day THEN RAISE EXCEPTION 'not allowed: billing_cycle_day'; END IF;
  IF NEW.cancelled_at      IS DISTINCT FROM OLD.cancelled_at      THEN RAISE EXCEPTION 'not allowed: cancelled_at'; END IF;
  IF NEW.paused_at         IS DISTINCT FROM OLD.paused_at         THEN RAISE EXCEPTION 'not allowed: paused_at'; END IF;
  IF NEW.paused_until      IS DISTINCT FROM OLD.paused_until      THEN RAISE EXCEPTION 'not allowed: paused_until'; END IF;
  IF NEW.client_id         IS DISTINCT FROM OLD.client_id         THEN RAISE EXCEPTION 'not allowed: client_id'; END IF;
  IF NEW.id                IS DISTINCT FROM OLD.id                THEN RAISE EXCEPTION 'not allowed: id'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_accounts_client_safe_update_trg ON public.accounts;
CREATE TRIGGER enforce_accounts_client_safe_update_trg
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounts_client_safe_update();
