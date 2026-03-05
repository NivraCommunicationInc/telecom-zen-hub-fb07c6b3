
-- ============================================================================
-- Trigger: auto-provision services when order status becomes 'completed'
-- This catches ALL completion paths: admin UI, edge functions, direct SQL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_provision_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only fire when status changes TO 'completed' or 'installation_completed'
  IF NEW.status IN ('completed', 'installation_completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'installation_completed')) THEN
    
    -- Only provision if order has line_items
    IF NEW.equipment_details IS NOT NULL 
       AND NEW.equipment_details->'line_items' IS NOT NULL
       AND jsonb_array_length(NEW.equipment_details->'line_items') > 0 THEN
      
      v_result := provision_services_for_order(NEW.id);
      
      IF NOT COALESCE((v_result->>'success')::BOOLEAN, false) THEN
        -- Block completion: set to provisioning_failed instead
        INSERT INTO billing_system_alerts (
          alert_type, entity_type, entity_id, details
        ) VALUES (
          'provisioning_failed', 'order', NEW.id::text,
          jsonb_build_object(
            'order_number', NEW.order_number,
            'error', v_result->>'error',
            'attempted_status', NEW.status
          )
        );
        NEW.status := 'provisioning_failed';
        RAISE WARNING '[PROVISIONING] Order % failed provisioning: %', NEW.order_number, v_result->>'error';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists first to avoid duplicates
DROP TRIGGER IF EXISTS trg_provision_on_completion ON orders;

CREATE TRIGGER trg_provision_on_completion
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_provision_on_order_completion();
