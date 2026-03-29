
-- Add 'revoked' to sync_status check constraint
ALTER TABLE field_sales_orders DROP CONSTRAINT field_sales_orders_sync_status_check;
ALTER TABLE field_sales_orders ADD CONSTRAINT field_sales_orders_sync_status_check
  CHECK (sync_status = ANY (ARRAY['pending','syncing','synced','error','revoked']));

-- Also update the propagation trigger to use search_path
CREATE OR REPLACE FUNCTION fn_propagate_order_status_to_field()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('fraud', 'cancelled', 'canceled')
     AND OLD.status NOT IN ('fraud', 'cancelled', 'canceled') THEN
    UPDATE field_sales_orders
    SET sync_status = 'revoked',
        sync_error = 'Core order marked as ' || NEW.status,
        updated_at = now()
    WHERE converted_order_id = NEW.id
      AND sync_status = 'synced';
  END IF;
  RETURN NEW;
END;
$$;

-- Also fix activation trigger with search_path
CREATE OR REPLACE FUNCTION fn_activate_sub_on_order_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('activated', 'delivered')
     AND OLD.status NOT IN ('activated', 'delivered') THEN
    UPDATE billing_subscriptions
    SET status = 'active', updated_at = now()
    WHERE order_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;
