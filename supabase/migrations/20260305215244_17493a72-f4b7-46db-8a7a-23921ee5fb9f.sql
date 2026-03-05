
-- Add hold_expires_at to appointments for hold mechanism
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

-- Create function to create an appointment hold (atomic, with capacity check)
CREATE OR REPLACE FUNCTION public.create_appointment_hold(
  p_client_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_time_slot TEXT,
  p_service_type TEXT DEFAULT 'Internet',
  p_service_address TEXT DEFAULT '',
  p_service_city TEXT DEFAULT '',
  p_service_postal_code TEXT DEFAULT '',
  p_installation_method TEXT DEFAULT 'auto',
  p_installation_id UUID DEFAULT NULL,
  p_slot_id UUID DEFAULT NULL,
  p_hold_minutes INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  v_hold_expires TIMESTAMPTZ;
  v_existing_hold UUID;
BEGIN
  -- Check for existing active hold by this client (reuse if exists)
  SELECT id INTO v_existing_hold
  FROM appointments
  WHERE client_id = p_client_id
    AND status = 'hold'
    AND hold_expires_at > now()
  LIMIT 1;

  -- If client already has an active hold, cancel it first
  IF v_existing_hold IS NOT NULL THEN
    UPDATE appointments SET status = 'cancelled', cancellation_reason = 'replaced_by_new_hold'
    WHERE id = v_existing_hold;
  END IF;

  v_hold_expires := now() + (p_hold_minutes || ' minutes')::INTERVAL;

  INSERT INTO appointments (
    client_id,
    title,
    description,
    scheduled_at,
    service_type,
    service_address,
    service_city,
    service_postal_code,
    installation_method,
    status,
    hold_expires_at,
    created_by
  ) VALUES (
    p_client_id,
    'Installation - ' || p_service_type,
    p_time_slot,
    p_scheduled_at,
    p_service_type,
    p_service_address,
    p_service_city,
    p_service_postal_code,
    p_installation_method,
    'hold',
    v_hold_expires,
    p_client_id
  )
  RETURNING id INTO v_appointment_id;

  -- If a technician slot was provided, book it atomically
  IF p_slot_id IS NOT NULL AND p_installation_id IS NOT NULL THEN
    PERFORM book_slot(p_slot_id, p_installation_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'hold_expires_at', v_hold_expires
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create function to confirm a held appointment
CREATE OR REPLACE FUNCTION public.confirm_appointment_hold(
  p_appointment_id UUID,
  p_order_id UUID,
  p_client_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT status, hold_expires_at INTO v_status, v_expires
  FROM appointments
  WHERE id = p_appointment_id AND client_id = p_client_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF v_status = 'hold' AND v_expires < now() THEN
    UPDATE appointments SET status = 'expired' WHERE id = p_appointment_id;
    RETURN json_build_object('success', false, 'error', 'hold_expired');
  END IF;

  IF v_status NOT IN ('hold', 'scheduled') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_status_' || v_status);
  END IF;

  UPDATE appointments
  SET status = 'confirmed',
      order_id = p_order_id,
      hold_expires_at = NULL,
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Auto-expire old holds (can be called by cron or checked on read)
CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE appointments
  SET status = 'expired'
  WHERE status = 'hold' AND hold_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
