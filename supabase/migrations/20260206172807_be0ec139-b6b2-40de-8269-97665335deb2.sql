
-- ============================================================
-- MIGRATION: Convertir tous les identifiants au format v2.4
-- Règle: Premier chiffre 2-9, 100% numérique, longueur fixe
-- ============================================================

-- 1. Fonction helper pour générer des IDs sécurisés (2-9)
CREATE OR REPLACE FUNCTION generate_secure_numeric_id(p_length INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  first_digit INT;
  remaining TEXT;
  result TEXT;
BEGIN
  -- Premier chiffre: 2-9 (jamais 0 ou 1)
  first_digit := floor(random() * 8 + 2)::INT;
  
  -- Reste des chiffres: 0-9
  remaining := '';
  FOR i IN 1..(p_length - 1) LOOP
    remaining := remaining || floor(random() * 10)::INT::TEXT;
  END LOOP;
  
  result := first_digit::TEXT || remaining;
  RETURN result;
END;
$$;

-- 2. Mettre à jour les billing_invoices (7 chiffres)
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
  counter INT := 0;
BEGIN
  FOR rec IN SELECT id FROM billing_invoices WHERE invoice_number !~ '^[2-9][0-9]{6}$' LOOP
    LOOP
      new_number := generate_secure_numeric_id(7);
      -- Vérifier l'unicité
      EXIT WHEN NOT EXISTS (SELECT 1 FROM billing_invoices WHERE invoice_number = new_number);
    END LOOP;
    
    UPDATE billing_invoices SET invoice_number = new_number WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Factures mises à jour: %', counter;
END;
$$;

-- 3. Mettre à jour les orders (5 chiffres)
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
  counter INT := 0;
BEGIN
  FOR rec IN SELECT id FROM orders WHERE order_number !~ '^[2-9][0-9]{4}$' LOOP
    LOOP
      new_number := generate_secure_numeric_id(5);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_number);
    END LOOP;
    
    UPDATE orders SET order_number = new_number WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Commandes mises à jour: %', counter;
END;
$$;

-- 4. Mettre à jour les contracts (9 chiffres)
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
  counter INT := 0;
BEGIN
  FOR rec IN SELECT id FROM contracts WHERE contract_number !~ '^[2-9][0-9]{8}$' LOOP
    LOOP
      new_number := generate_secure_numeric_id(9);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM contracts WHERE contract_number = new_number);
    END LOOP;
    
    UPDATE contracts SET contract_number = new_number WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Contrats mis à jour: %', counter;
END;
$$;

-- 5. Ajouter des triggers pour les futures insertions

-- Trigger pour billing_invoices
CREATE OR REPLACE FUNCTION set_secure_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  -- Seulement si invoice_number est NULL ou ne respecte pas le format
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

DROP TRIGGER IF EXISTS trg_set_secure_invoice_number ON billing_invoices;
CREATE TRIGGER trg_set_secure_invoice_number
  BEFORE INSERT ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_secure_invoice_number();

-- Trigger pour orders
CREATE OR REPLACE FUNCTION set_secure_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_set_secure_order_number ON orders;
CREATE TRIGGER trg_set_secure_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_secure_order_number();

-- Trigger pour contracts
CREATE OR REPLACE FUNCTION set_secure_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_set_secure_contract_number ON contracts;
CREATE TRIGGER trg_set_secure_contract_number
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_secure_contract_number();
