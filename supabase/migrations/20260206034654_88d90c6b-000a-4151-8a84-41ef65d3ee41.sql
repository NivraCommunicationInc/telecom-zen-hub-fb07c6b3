-- ============================================================================
-- FIX: Guaranteed Order Snapshot Creation (Security Definer Function)
-- ============================================================================
-- Problem: RLS policies can fail silently when creating order_snapshots
-- due to timing/race conditions between order creation and snapshot insertion.
-- Solution: Create a security definer function that bypasses RLS for snapshot creation.

-- 1. Add missing client fields to orders table for redundancy
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS client_full_address TEXT;

-- 2. Create comment for documentation
COMMENT ON COLUMN public.orders.client_email IS 'Client email captured at order time for admin visibility';
COMMENT ON COLUMN public.orders.client_full_address IS 'Full formatted service address captured at order time';

-- 3. Create security definer function for guaranteed snapshot insertion
CREATE OR REPLACE FUNCTION public.create_order_snapshot(
  p_order_id UUID,
  p_client_snapshot JSONB,
  p_services_snapshot JSONB DEFAULT NULL,
  p_equipment_snapshot JSONB DEFAULT NULL,
  p_fees_snapshot JSONB DEFAULT NULL,
  p_billing_snapshot JSONB DEFAULT NULL,
  p_selected_channels_snapshot JSONB DEFAULT NULL,
  p_payment_method_snapshot JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id UUID;
  v_order_exists BOOLEAN;
BEGIN
  -- Verify order exists
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RAISE EXCEPTION 'Order % does not exist', p_order_id;
  END IF;
  
  -- Check if snapshot already exists for this order
  SELECT id INTO v_snapshot_id 
  FROM order_snapshots 
  WHERE order_id = p_order_id 
  ORDER BY version DESC 
  LIMIT 1;
  
  IF v_snapshot_id IS NOT NULL THEN
    -- Update existing snapshot
    UPDATE order_snapshots
    SET 
      client_snapshot = COALESCE(p_client_snapshot, client_snapshot),
      services_snapshot = COALESCE(p_services_snapshot, services_snapshot),
      equipment_snapshot = COALESCE(p_equipment_snapshot, equipment_snapshot),
      fees_snapshot = COALESCE(p_fees_snapshot, fees_snapshot),
      billing_snapshot = COALESCE(p_billing_snapshot, billing_snapshot),
      selected_channels_snapshot = COALESCE(p_selected_channels_snapshot, selected_channels_snapshot),
      payment_method_snapshot = COALESCE(p_payment_method_snapshot, payment_method_snapshot),
      updated_at = NOW()
    WHERE id = v_snapshot_id;
    
    RETURN v_snapshot_id;
  ELSE
    -- Insert new snapshot
    INSERT INTO order_snapshots (
      order_id,
      version,
      client_snapshot,
      services_snapshot,
      equipment_snapshot,
      fees_snapshot,
      billing_snapshot,
      selected_channels_snapshot,
      payment_method_snapshot,
      accepted_at,
      accepted_method
    ) VALUES (
      p_order_id,
      1,
      p_client_snapshot,
      p_services_snapshot,
      p_equipment_snapshot,
      p_fees_snapshot,
      p_billing_snapshot,
      p_selected_channels_snapshot,
      p_payment_method_snapshot,
      NOW(),
      'web_checkout'
    )
    RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
  END IF;
END;
$$;

-- 4. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_order_snapshot TO authenticated;

-- 5. Create trigger to auto-populate client fields from orders on insert/update
CREATE OR REPLACE FUNCTION public.sync_order_client_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Build full address if components exist
  IF NEW.shipping_address IS NOT NULL THEN
    NEW.client_full_address := CONCAT_WS(', ',
      NEW.shipping_address,
      NEW.shipping_city,
      NEW.shipping_province,
      NEW.shipping_postal_code
    );
  END IF;
  
  -- Try to get email from profile if not set
  IF NEW.client_email IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT email INTO NEW.client_email
    FROM profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_sync_order_client_fields ON orders;

-- Create trigger
CREATE TRIGGER trg_sync_order_client_fields
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_client_fields();

-- 6. Backfill existing orders with client_email from profiles
UPDATE orders o
SET 
  client_email = p.email,
  client_full_address = CONCAT_WS(', ', o.shipping_address, o.shipping_city, o.shipping_province, o.shipping_postal_code)
FROM profiles p
WHERE o.user_id = p.user_id
  AND o.client_email IS NULL
  AND p.email IS NOT NULL;