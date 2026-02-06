-- Add client signature columns to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS client_signature TEXT,
ADD COLUMN IF NOT EXISTS client_signature_type TEXT CHECK (client_signature_type IN ('canvas', 'text'));

-- Add comment for documentation
COMMENT ON COLUMN public.contracts.client_signature IS 'Client typed or drawn signature';
COMMENT ON COLUMN public.contracts.client_signature_type IS 'Type of signature: canvas (drawn) or text (typed)';