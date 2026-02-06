
-- Corriger les avertissements de sécurité: ajouter search_path à toutes les fonctions

-- 1. generate_secure_numeric_id
CREATE OR REPLACE FUNCTION generate_secure_numeric_id(p_length INT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  first_digit INT;
  remaining TEXT;
  result TEXT;
BEGIN
  first_digit := floor(random() * 8 + 2)::INT;
  remaining := '';
  FOR i IN 1..(p_length - 1) LOOP
    remaining := remaining || floor(random() * 10)::INT::TEXT;
  END LOOP;
  result := first_digit::TEXT || remaining;
  RETURN result;
END;
$$;

-- 2. set_secure_invoice_number
CREATE OR REPLACE FUNCTION set_secure_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number !~ '^[2-9][0-9]{6}$' THEN
    LOOP
      new_number := generate_secure_numeric_id(7);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM billing_invoices WHERE invoice_number = new_number);
    END LOOP;
    NEW.invoice_number := new_number;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. set_secure_order_number
CREATE OR REPLACE FUNCTION set_secure_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number !~ '^[2-9][0-9]{4}$' THEN
    LOOP
      new_number := generate_secure_numeric_id(5);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_number);
    END LOOP;
    NEW.order_number := new_number;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. set_secure_contract_number
CREATE OR REPLACE FUNCTION set_secure_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number !~ '^[2-9][0-9]{8}$' THEN
    LOOP
      new_number := generate_secure_numeric_id(9);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM contracts WHERE contract_number = new_number);
    END LOOP;
    NEW.contract_number := new_number;
  END IF;
  RETURN NEW;
END;
$$;
