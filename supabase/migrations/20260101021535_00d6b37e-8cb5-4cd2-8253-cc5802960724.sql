-- Create technicians table
CREATE TABLE public.technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  specializations TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on technicians
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

-- RLS policies for technicians
CREATE POLICY "Admins can manage technicians"
ON public.technicians FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Technicians can view their own record"
ON public.technicians FOR SELECT
USING (auth.uid() = user_id);

-- Add technician role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'technician';

-- Add payment_reference and technician_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS appointment_notes TEXT;

-- Add payment_reference to billing
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Add payment_reference to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create sequence for payment reference if not exists
CREATE SEQUENCE IF NOT EXISTS payment_ref_seq START 1;

-- Function to generate payment reference number
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'PAY-QC-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('payment_ref_seq')::TEXT, 5, '0');
END;
$$;

-- Update timestamp trigger for technicians
CREATE TRIGGER update_technicians_updated_at
BEFORE UPDATE ON public.technicians
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();