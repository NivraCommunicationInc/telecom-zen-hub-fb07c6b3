-- Add port_request and identity_snapshot columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS port_request jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS identity_snapshot jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.port_request IS 'Port-in request details: phone_number, carrier, account_number, imei, consent_at';
COMMENT ON COLUMN public.orders.identity_snapshot IS 'Identity verification snapshot: id_type, id_number, id_expiration, id_province';