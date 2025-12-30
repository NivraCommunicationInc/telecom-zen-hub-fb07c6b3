-- Create payments table to store all payment records
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_id UUID REFERENCES public.billing(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'credit_card', 'etransfer'
  reference_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  
  -- Credit card details (last 4 only)
  card_last_four TEXT,
  card_type TEXT,
  
  -- E-transfer details
  etransfer_sender_name TEXT,
  etransfer_amount NUMERIC,
  received_by TEXT, -- Employee name who received the payment
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
ON public.payments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own payments
CREATE POLICY "Users can view their own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_billing_id ON public.payments(billing_id);
CREATE INDEX idx_payments_reference ON public.payments(reference_number);