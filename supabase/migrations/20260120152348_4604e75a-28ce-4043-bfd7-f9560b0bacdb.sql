-- Fix function search_path for security
CREATE OR REPLACE FUNCTION calculate_activation_fee(service_count INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  IF service_count IS NULL OR service_count <= 0 THEN
    RETURN 0;
  ELSIF service_count = 1 THEN
    RETURN 25.00;
  ELSE
    RETURN 45.00; -- Flat fee for 2+ services
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;