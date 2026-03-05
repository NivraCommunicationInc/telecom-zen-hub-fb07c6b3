
-- Guard: prevent client from modifying identity snapshot on orders after creation
CREATE OR REPLACE FUNCTION fn_lock_order_identity_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin/employee can modify anything
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee') THEN
    RETURN NEW;
  END IF;

  -- Block client from changing identity snapshot fields
  IF (
    COALESCE(NEW.client_first_name, '') IS DISTINCT FROM COALESCE(OLD.client_first_name, '') OR
    COALESCE(NEW.client_last_name, '') IS DISTINCT FROM COALESCE(OLD.client_last_name, '') OR
    COALESCE(NEW.client_email, '') IS DISTINCT FROM COALESCE(OLD.client_email, '')
  ) THEN
    RAISE EXCEPTION 'ORDER_IDENTITY_LOCKED: Les champs identité de la commande sont un snapshot immuable et ne peuvent pas être modifiés par le client.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_order_identity_snapshot
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_order_identity_snapshot();
