-- Switch wifi_password_encrypted to plain text storage
ALTER TABLE public.activation_requests
  ALTER COLUMN wifi_password_encrypted TYPE text USING convert_from(wifi_password_encrypted, 'UTF8');

-- Replace submit_activation_request to insert plain text
CREATE OR REPLACE FUNCTION public.submit_activation_request(
  p_wifi_network_name text,
  p_wifi_password text,
  p_contact_phone text,
  p_client_notes text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
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
  INSERT INTO public.activation_requests (
    client_id, order_id, wifi_network_name, wifi_password_encrypted, contact_phone, client_notes
  )
  VALUES (
    v_user_id, p_order_id, p_wifi_network_name, p_wifi_password, p_contact_phone, p_client_notes
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_activation_request(text,text,text,text,uuid) TO authenticated;

-- Replace decrypt_wifi_password to just return plain text (back-compat for existing UI calls)
CREATE OR REPLACE FUNCTION public.decrypt_wifi_password(p_encrypted text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_encrypted;
$$;

GRANT EXECUTE ON FUNCTION public.decrypt_wifi_password(text) TO authenticated;