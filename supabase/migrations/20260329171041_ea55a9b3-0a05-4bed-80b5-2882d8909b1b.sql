
-- P0-1: Trigger to activate subscriptions when order reaches activated/delivered
CREATE OR REPLACE FUNCTION fn_activate_sub_on_order_activation()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_activate_sub_on_order_activation();

-- P0-3: Trigger to propagate fraud/cancelled to field_sales_orders
CREATE OR REPLACE FUNCTION fn_propagate_order_status_to_field()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_order_status_to_field ON orders;
CREATE TRIGGER trg_propagate_order_status_to_field
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_propagate_order_status_to_field();

-- P0-4: Add restrictive policies on daily_backup_log and paypal_plan_cache
-- daily_backup_log: admin-only read, no public access
CREATE POLICY "admin_read_daily_backup_log" ON daily_backup_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  ));

-- paypal_plan_cache: admin-only read
CREATE POLICY "admin_read_paypal_plan_cache" ON paypal_plan_cache
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  ));
