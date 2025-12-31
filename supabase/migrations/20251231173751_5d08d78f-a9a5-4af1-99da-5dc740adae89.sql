-- Create sequences for auto-generating numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS order_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS request_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 10;
CREATE SEQUENCE IF NOT EXISTS contract_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS client_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS payment_seq START 1000001;

-- Function to generate invoice number (INV-YYYY-####)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
END;
$$;

-- Function to generate order number (ORD-YYYY-####)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'ORD-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('order_seq')::TEXT, 4, '0');
END;
$$;

-- Function to generate request confirmation number (REQ-####)
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'REQ-' || LPAD(nextval('request_seq')::TEXT, 4, '0');
END;
$$;

-- Function to generate ticket number (TCK-##)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'TCK-' || LPAD(nextval('ticket_seq')::TEXT, 2, '0');
END;
$$;

-- Function to generate contract number (CTR-####)
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'CTR-' || LPAD(nextval('contract_seq')::TEXT, 4, '0');
END;
$$;

-- Function to generate client account number (NIV-QC-####)
CREATE OR REPLACE FUNCTION generate_client_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'NIV-QC-' || LPAD(nextval('client_seq')::TEXT, 4, '0');
END;
$$;

-- Function to generate payment confirmation number (PAY-#######)
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'PAY-' || LPAD(nextval('payment_seq')::TEXT, 7, '0');
END;
$$;

-- Add client_number to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_number TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'individual';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employer_sector TEXT;

-- Add order_number and enhanced fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'client';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tps_rate NUMERIC DEFAULT 0.05;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tvq_rate NUMERIC DEFAULT 0.09975;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tps_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tvq_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 30;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS activation_fee NUMERIC DEFAULT 25;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS installation_fee NUMERIC DEFAULT 50;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS installation_credit NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS credits_applied NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS late_fee_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS related_ticket_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS related_contract_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS savings_estimated NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Add request_number to contact_requests
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS request_number TEXT UNIQUE;

-- Add ticket_number to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Update contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_number TEXT UNIQUE;

-- Update billing table with new fields
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS tps_amount NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS tvq_amount NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS activation_fee NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS installation_fee NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS related_order_number TEXT;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS equipment_id TEXT;

-- Trigger to auto-generate invoice_number on billing insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_invoice_number ON public.billing;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Trigger to auto-generate order_number on orders insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Trigger to auto-generate request_number on contact_requests insert
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := generate_request_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_request_number ON public.contact_requests;
CREATE TRIGGER trigger_set_request_number
  BEFORE INSERT ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_request_number();

-- Trigger to auto-generate ticket_number on support_tickets insert
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_ticket_number ON public.support_tickets;
CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Trigger to auto-generate contract_number on contracts insert
CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_number IS NULL THEN
    NEW.contract_number := generate_contract_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_contract_number ON public.contracts;
CREATE TRIGGER trigger_set_contract_number
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_number();

-- Trigger to auto-generate client_number on profiles insert
CREATE OR REPLACE FUNCTION set_client_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_number IS NULL THEN
    NEW.client_number := generate_client_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_client_number ON public.profiles;
CREATE TRIGGER trigger_set_client_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_client_number();

-- Function to calculate order total with taxes and fees
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_amount NUMERIC;
  installation_final NUMERIC;
BEGIN
  -- Calculate installation fee after credit
  installation_final := GREATEST(0, COALESCE(NEW.installation_fee, 0) - COALESCE(NEW.installation_credit, 0));
  
  -- Base amount (subtotal + fees - discounts)
  base_amount := COALESCE(NEW.subtotal, 0) 
    + COALESCE(NEW.delivery_fee, 30) 
    + COALESCE(NEW.activation_fee, 25) 
    + installation_final
    - COALESCE(NEW.discount_amount, 0);
  
  -- Calculate taxes (Quebec TPS 5% + TVQ 9.975%)
  NEW.tps_amount := ROUND(base_amount * 0.05, 2);
  NEW.tvq_amount := ROUND(base_amount * 0.09975, 2);
  
  -- Calculate total amount
  NEW.total_amount := base_amount + NEW.tps_amount + NEW.tvq_amount + COALESCE(NEW.late_fee_amount, 0) - COALESCE(NEW.credits_applied, 0);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_order_total ON public.orders;
CREATE TRIGGER trigger_calculate_order_total
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_total();

-- Function to calculate billing total with taxes
CREATE OR REPLACE FUNCTION calculate_billing_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_amount NUMERIC;
BEGIN
  -- Base amount
  base_amount := COALESCE(NEW.subtotal, NEW.amount) 
    + COALESCE(NEW.fees, 0) 
    + COALESCE(NEW.delivery_fee, 0) 
    + COALESCE(NEW.activation_fee, 0) 
    + COALESCE(NEW.installation_fee, 0)
    - COALESCE(NEW.discount_amount, 0);
  
  -- Calculate taxes
  NEW.tps_amount := ROUND(base_amount * 0.05, 2);
  NEW.tvq_amount := ROUND(base_amount * 0.09975, 2);
  
  -- Store subtotal if not set
  IF NEW.subtotal IS NULL THEN
    NEW.subtotal := NEW.amount;
  END IF;
  
  -- Total = base + taxes + late fee - credits
  NEW.amount := base_amount + NEW.tps_amount + NEW.tvq_amount + COALESCE(NEW.late_fee_amount, 0) - COALESCE(NEW.credits, 0);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_billing_total ON public.billing;
CREATE TRIGGER trigger_calculate_billing_total
  BEFORE INSERT OR UPDATE ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION calculate_billing_total();

-- Generate client numbers for existing profiles that don't have one
UPDATE public.profiles 
SET client_number = generate_client_number() 
WHERE client_number IS NULL;

-- Generate numbers for existing records that don't have them
UPDATE public.billing 
SET invoice_number = generate_invoice_number() 
WHERE invoice_number IS NULL;

UPDATE public.orders 
SET order_number = generate_order_number() 
WHERE order_number IS NULL;

UPDATE public.contact_requests 
SET request_number = generate_request_number() 
WHERE request_number IS NULL;

UPDATE public.support_tickets 
SET ticket_number = generate_ticket_number() 
WHERE ticket_number IS NULL;

UPDATE public.contracts 
SET contract_number = generate_contract_number() 
WHERE contract_number IS NULL;