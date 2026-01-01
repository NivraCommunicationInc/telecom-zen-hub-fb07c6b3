-- Add RLS policy for clients to INSERT their own appointments (needed for checkout)
DROP POLICY IF EXISTS "Clients can create their own appointments" ON public.appointments;
CREATE POLICY "Clients can create their own appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
  auth.uid() = client_id OR 
  auth.uid() = created_by
);

-- Update client UPDATE policy to allow reschedule/cancel
DROP POLICY IF EXISTS "Clients can update their own appointments" ON public.appointments;
CREATE POLICY "Clients can update their own appointments" 
ON public.appointments 
FOR UPDATE 
USING (
  auth.uid() = client_id OR 
  client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = client_id OR 
  client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())
);

-- Add employees can view all appointments policy
DROP POLICY IF EXISTS "Employees can view all appointments" ON public.appointments;
CREATE POLICY "Employees can view all appointments" 
ON public.appointments 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::app_role));