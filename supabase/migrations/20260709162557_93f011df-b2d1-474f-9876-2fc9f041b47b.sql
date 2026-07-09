CREATE OR REPLACE FUNCTION public.enforce_dispute_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_staff BOOLEAN := FALSE;
  v_is_service BOOLEAN := FALSE;
BEGIN
  -- Server-side (Edge Function via service_role): always allow.
  -- Staff authorization is enforced by the calling Edge Function.
  v_is_service := current_setting('role', true) = 'service_role';
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'employee')
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    IF OLD.status != 'awaiting_client' THEN
      RAISE EXCEPTION 'Cannot update dispute when status is not awaiting_client';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Cannot modify dispute id'; END IF;
    IF NEW.dispute_number IS DISTINCT FROM OLD.dispute_number THEN RAISE EXCEPTION 'Cannot modify dispute_number'; END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Cannot modify user_id'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Cannot modify status'; END IF;
    IF NEW.public_message IS DISTINCT FROM OLD.public_message THEN RAISE EXCEPTION 'Cannot modify public_message'; END IF;
    IF NEW.staff_notes IS DISTINCT FROM OLD.staff_notes THEN RAISE EXCEPTION 'Cannot modify staff_notes'; END IF;
    IF NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes THEN RAISE EXCEPTION 'Cannot modify resolution_notes'; END IF;
    IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN RAISE EXCEPTION 'Cannot modify rejection_reason'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Cannot modify created_at'; END IF;
    IF NEW.processed_by_id IS DISTINCT FROM OLD.processed_by_id THEN RAISE EXCEPTION 'Cannot modify processed_by_id'; END IF;
    IF NEW.processed_by_name IS DISTINCT FROM OLD.processed_by_name THEN RAISE EXCEPTION 'Cannot modify processed_by_name'; END IF;
    IF NEW.processed_at IS DISTINCT FROM OLD.processed_at THEN RAISE EXCEPTION 'Cannot modify processed_at'; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized dispute update';
END;
$function$;