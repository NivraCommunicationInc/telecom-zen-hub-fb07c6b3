-- Fix ticket number generation to prevent duplicates
-- Use year prefix and 6 digits for uniqueness

-- Drop the old function first
DROP FUNCTION IF EXISTS generate_ticket_number() CASCADE;

-- Create improved ticket number generation function
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  year_prefix TEXT;
BEGIN
  year_prefix := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  new_number := 'TKT-' || year_prefix || '-' || LPAD(nextval('ticket_seq')::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Recreate the trigger function to use the new format
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON support_tickets;
CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();