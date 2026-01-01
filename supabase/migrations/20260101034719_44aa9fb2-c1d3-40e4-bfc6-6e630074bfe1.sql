-- Add access_code column for technician 4-digit login
ALTER TABLE public.technicians 
ADD COLUMN IF NOT EXISTS access_code text;

-- Add constraint for 4-digit format
ALTER TABLE public.technicians
ADD CONSTRAINT technicians_access_code_format 
CHECK (access_code IS NULL OR (access_code ~ '^[0-9]{4}$'));

-- Create index for login lookups
CREATE INDEX IF NOT EXISTS idx_technicians_email_access 
ON public.technicians(email, access_code);

-- Add Completed-Installation status support (no schema change needed, just documenting)
COMMENT ON COLUMN public.orders.status IS 'Order status: pending, hold, verification, back_order, cancelled, shipped, completed, completed_installation';