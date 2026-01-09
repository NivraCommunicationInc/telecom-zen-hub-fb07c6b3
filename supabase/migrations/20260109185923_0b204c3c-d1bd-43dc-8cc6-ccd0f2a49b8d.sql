
-- Add unique constraint on payment_methods
ALTER TABLE public.payment_methods
DROP CONSTRAINT IF EXISTS unique_user_payment_method;

ALTER TABLE public.payment_methods
ADD CONSTRAINT unique_user_payment_method 
UNIQUE (user_id, payment_fingerprint);


-- Create client_billing_preferences table for preauth opt-in tracking

CREATE TABLE IF NOT EXISTS public.client_billing_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preauth_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  preauth_opt_in_at TIMESTAMPTZ NULL,
  preauth_discount_active BOOLEAN NOT NULL DEFAULT FALSE,
  preauth_discount_amount NUMERIC(10,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_billing_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own billing preferences"
ON public.client_billing_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own billing preferences"
ON public.client_billing_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing preferences"
ON public.client_billing_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.client_billing_preferences TO authenticated;

-- Updated_at trigger
CREATE TRIGGER update_client_billing_preferences_updated_at
BEFORE UPDATE ON public.client_billing_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
