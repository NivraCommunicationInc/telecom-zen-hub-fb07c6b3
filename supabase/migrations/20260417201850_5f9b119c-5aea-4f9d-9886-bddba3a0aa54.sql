-- Add equipment checklist + order_id link columns to activation_requests
ALTER TABLE public.activation_requests
  ADD COLUMN IF NOT EXISTS light_color text,
  ADD COLUMN IF NOT EXISTS has_terminal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terminal_connected boolean;

-- Replace submit_activation_request to accept new checklist fields
CREATE OR REPLACE FUNCTION public.submit_activation_request(
  p_wifi_network_name text,
  p_wifi_password text,
  p_contact_phone text,
  p_client_notes text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_light_color text DEFAULT NULL,
  p_has_terminal boolean DEFAULT false,
  p_terminal_connected boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF length(coalesce(p_wifi_network_name, '')) < 1 OR length(p_wifi_network_name) > 64 THEN
    RAISE EXCEPTION 'Invalid wifi network name';
  END IF;
  IF length(coalesce(p_wifi_password, '')) < 8 THEN
    RAISE EXCEPTION 'Wifi password must be at least 8 characters';
  END IF;
  IF length(coalesce(p_contact_phone, '')) < 7 THEN
    RAISE EXCEPTION 'Invalid contact phone';
  END IF;

  -- If order_id provided, ensure it belongs to client and isn't already in an active activation request
  IF p_order_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND client_id = v_user_id) THEN
      RAISE EXCEPTION 'Order not found or not owned by client';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.activation_requests
      WHERE order_id = p_order_id
        AND status NOT IN ('rejected', 'cancelled', 'completed')
    ) THEN
      RAISE EXCEPTION 'An active activation request already exists for this order';
    END IF;
  END IF;

  INSERT INTO public.activation_requests (
    client_id, order_id, wifi_network_name, wifi_password_encrypted,
    contact_phone, client_notes, light_color, has_terminal, terminal_connected
  )
  VALUES (
    v_user_id, p_order_id, p_wifi_network_name, p_wifi_password,
    p_contact_phone, p_client_notes, p_light_color, p_has_terminal, p_terminal_connected
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_activation_request(text,text,text,text,uuid,text,boolean,boolean) TO authenticated;