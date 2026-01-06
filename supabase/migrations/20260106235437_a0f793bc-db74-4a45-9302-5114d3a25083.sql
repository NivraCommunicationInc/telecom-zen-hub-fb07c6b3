-- Create BEFORE UPDATE trigger to restrict client updates on payment_disputes
-- Client can ONLY update client_message when status = awaiting_client
-- All other protected fields must remain unchanged

CREATE OR REPLACE FUNCTION public.enforce_dispute_client_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_staff BOOLEAN := FALSE;
BEGIN
  -- Check if actor is staff (admin/employee)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'employee')
  ) INTO v_is_staff;
  
  -- Staff can update anything
  IF v_is_staff THEN
    RETURN NEW;
  END IF;
  
  -- For clients: must be owner and status must be awaiting_client
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    -- Status must be awaiting_client to allow any update
    IF OLD.status != 'awaiting_client' THEN
      RAISE EXCEPTION 'Cannot update dispute when status is not awaiting_client';
    END IF;
    
    -- Enforce immutability of protected fields
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Cannot modify dispute id';
    END IF;
    IF NEW.dispute_number IS DISTINCT FROM OLD.dispute_number THEN
      RAISE EXCEPTION 'Cannot modify dispute_number';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot modify user_id';
    END IF;
    IF NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
      RAISE EXCEPTION 'Cannot modify payment_id';
    END IF;
    IF NEW.reason_code IS DISTINCT FROM OLD.reason_code THEN
      RAISE EXCEPTION 'Cannot modify reason_code';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Cannot modify status';
    END IF;
    IF NEW.public_message IS DISTINCT FROM OLD.public_message THEN
      RAISE EXCEPTION 'Cannot modify public_message';
    END IF;
    IF NEW.staff_notes IS DISTINCT FROM OLD.staff_notes THEN
      RAISE EXCEPTION 'Cannot modify staff_notes';
    END IF;
    IF NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes THEN
      RAISE EXCEPTION 'Cannot modify resolution_notes';
    END IF;
    IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Cannot modify rejection_reason';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot modify created_at';
    END IF;
    IF NEW.processed_by_id IS DISTINCT FROM OLD.processed_by_id THEN
      RAISE EXCEPTION 'Cannot modify processed_by_id';
    END IF;
    IF NEW.processed_by_name IS DISTINCT FROM OLD.processed_by_name THEN
      RAISE EXCEPTION 'Cannot modify processed_by_name';
    END IF;
    IF NEW.processed_at IS DISTINCT FROM OLD.processed_at THEN
      RAISE EXCEPTION 'Cannot modify processed_at';
    END IF;
    
    -- Only client_message (and updated_at auto) can change
    RETURN NEW;
  END IF;
  
  -- Default: reject
  RAISE EXCEPTION 'Unauthorized dispute update';
END;
$$;

CREATE TRIGGER enforce_dispute_client_update_trigger
BEFORE UPDATE ON public.payment_disputes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dispute_client_update();