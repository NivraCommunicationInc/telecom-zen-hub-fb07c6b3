CREATE OR REPLACE FUNCTION fn_hydrate_invoice_account_snapshot()
RETURNS TRIGGER
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

  SELECT acct.account_number INTO v_account_number
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
$$