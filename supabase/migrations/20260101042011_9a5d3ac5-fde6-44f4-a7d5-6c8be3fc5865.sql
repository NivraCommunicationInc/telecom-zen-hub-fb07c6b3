-- Add pre-authorized payment fields to payment_methods table
ALTER TABLE public.payment_methods
ADD COLUMN IF NOT EXISTS is_preauthorized boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preauthorized_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS encrypted_card_number text,
ADD COLUMN IF NOT EXISTS cardholder_name text;

-- Add pre-authorized discount fields to billing table
ALTER TABLE public.billing
ADD COLUMN IF NOT EXISTS preauth_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS preauth_discount_applied boolean DEFAULT false;

-- Add pre-authorized discount fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS preauth_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS preauth_card_id uuid REFERENCES public.payment_methods(id);

-- Create index for efficient preauthorized card lookup
CREATE INDEX IF NOT EXISTS idx_payment_methods_preauthorized 
ON public.payment_methods(user_id, is_preauthorized) 
WHERE is_preauthorized = true;