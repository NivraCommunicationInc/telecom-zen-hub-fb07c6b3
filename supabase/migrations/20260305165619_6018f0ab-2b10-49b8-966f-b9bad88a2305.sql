
-- 1. Table de réservation de créneaux technicien
CREATE TABLE public.technician_slot_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.technician_slots(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.installations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  slot_date date NOT NULL,
  time_slot text NOT NULL,
  technician_level text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_id, installation_id),
  UNIQUE(installation_id)
);

-- 2. RLS
ALTER TABLE public.technician_slot_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own bookings"
  ON public.technician_slot_bookings FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own bookings"
  ON public.technician_slot_bookings FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- 3. RPC atomique book_slot
CREATE OR REPLACE FUNCTION public.book_slot(
  p_slot_id uuid,
  p_installation_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot technician_slots%ROWTYPE;
  v_booking_id uuid;
BEGIN
  -- Lock the slot row
  SELECT * INTO v_slot
  FROM technician_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_not_found');
  END IF;

  IF NOT v_slot.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_inactive');
  END IF;

  IF v_slot.booked >= v_slot.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_full');
  END IF;

  -- Insert booking
  INSERT INTO technician_slot_bookings (
    slot_id, installation_id, client_id, order_id,
    slot_date, time_slot, technician_level
  ) VALUES (
    p_slot_id, p_installation_id, auth.uid(), p_order_id,
    v_slot.slot_date, v_slot.time_slot, v_slot.technician_level
  )
  RETURNING id INTO v_booking_id;

  -- Increment booked count
  UPDATE technician_slots
  SET booked = booked + 1
  WHERE id = p_slot_id;

  -- Update installation with appointment info
  UPDATE installations
  SET appointment_date = v_slot.slot_date,
      time_slot = v_slot.time_slot,
      status = 'scheduled',
      updated_at = now()
  WHERE id = p_installation_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_date', v_slot.slot_date,
    'time_slot', v_slot.time_slot
  );
END;
$$;
