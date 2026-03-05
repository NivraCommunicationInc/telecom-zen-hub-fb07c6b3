-- 1) Immutability trigger: block ANY modification of account_number
CREATE OR REPLACE FUNCTION fn_lock_account_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS DISTINCT FROM OLD.account_number THEN
    RAISE EXCEPTION 'ACCOUNT_NUMBER_LOCKED: Le numéro de compte est immuable et ne peut jamais être modifié.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_account_number
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_account_number();

-- 2) Hydration trigger: auto-populate billing_snapshot_account_number on invoice creation
CREATE OR REPLACE FUNCTION fn_hydrate_invoice_account_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number TEXT;
BEGIN
  IF NEW.billing_snapshot_account_number IS NOT NULL AND NEW.billing_snapshot_account_number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT a.account_number INTO v_account_number
  FROM billing_customers bc
  JOIN profiles p ON p.user_id = bc.user_id
  JOIN accounts acct ON acct.client_id = p.id
  WHERE bc.id = NEW.customer_id
  ORDER BY acct.created_at DESC
  LIMIT 1;

  IF v_account_number IS NULL THEN
    SELECT p.account_number INTO v_account_number
    FROM billing_customers bc
    JOIN profiles p ON p.user_id = bc.user_id
    WHERE bc.id = NEW.customer_id;
  END IF;

  IF v_account_number IS NOT NULL THEN
    NEW.billing_snapshot_account_number := v_account_number;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hydrate_invoice_account_snapshot
  BEFORE INSERT ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_hydrate_invoice_account_snapshot();

-- 3) Lock invoice snapshot once set (immutable)
CREATE OR REPLACE FUNCTION fn_lock_invoice_account_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.billing_snapshot_account_number IS NOT NULL 
     AND OLD.billing_snapshot_account_number <> ''
     AND NEW.billing_snapshot_account_number IS DISTINCT FROM OLD.billing_snapshot_account_number THEN
    IF has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'INVOICE_ACCOUNT_SNAPSHOT_LOCKED: Le numéro de compte sur la facture est un snapshot immuable.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_invoice_account_snapshot
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_invoice_account_snapshot();