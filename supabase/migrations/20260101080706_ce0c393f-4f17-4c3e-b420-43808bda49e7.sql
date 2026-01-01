-- Create sequence for appointment numbers
CREATE SEQUENCE IF NOT EXISTS appointment_seq START WITH 10001;

-- Function to generate appointment numbers
CREATE OR REPLACE FUNCTION public.generate_appointment_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'NVR-APT-' || LPAD(nextval('appointment_seq')::TEXT, 5, '0');
END;
$$;

-- Add new columns to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS appointment_number text,
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.technicians(id),
ADD COLUMN IF NOT EXISTS service_type text,
ADD COLUMN IF NOT EXISTS installation_method text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS service_address text,
ADD COLUMN IF NOT EXISTS service_city text,
ADD COLUMN IF NOT EXISTS service_postal_code text,
ADD COLUMN IF NOT EXISTS client_phone text,
ADD COLUMN IF NOT EXISTS equipment_details jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS internal_notes text,
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by uuid,
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Trigger to auto-generate appointment number
CREATE OR REPLACE FUNCTION public.set_appointment_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.appointment_number IS NULL THEN
    NEW.appointment_number := generate_appointment_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_appointment_number_trigger ON public.appointments;
CREATE TRIGGER set_appointment_number_trigger
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_appointment_number();

-- Update existing appointments with appointment numbers
UPDATE public.appointments
SET appointment_number = generate_appointment_number()
WHERE appointment_number IS NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_appointment_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appointment_timestamp();

-- Add unique constraint on appointment_number
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_appointment_number_key UNIQUE (appointment_number);

-- RLS policies for technicians to view assigned appointments
DROP POLICY IF EXISTS "Technicians can view their assigned appointments" ON public.appointments;
CREATE POLICY "Technicians can view their assigned appointments"
ON public.appointments
FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role) AND 
  technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid())
);

-- RLS policy for technicians to update status only
DROP POLICY IF EXISTS "Technicians can update appointment status" ON public.appointments;
CREATE POLICY "Technicians can update appointment status"
ON public.appointments
FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role) AND 
  technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) AND 
  technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid())
);

-- Employees can manage appointments
DROP POLICY IF EXISTS "Employees can manage appointments" ON public.appointments;
CREATE POLICY "Employees can manage appointments"
ON public.appointments
FOR ALL
USING (has_role(auth.uid(), 'employee'::app_role));

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;