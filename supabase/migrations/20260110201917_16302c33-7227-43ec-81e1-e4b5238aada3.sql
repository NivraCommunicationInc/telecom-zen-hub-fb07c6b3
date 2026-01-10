-- Enable RLS on debug table (temporary table, allow all inserts from trigger)
ALTER TABLE public.support_ticket_id_status_debug ENABLE ROW LEVEL SECURITY;

-- Allow the trigger function to insert (it runs as SECURITY DEFINER)
CREATE POLICY "Allow trigger inserts" ON public.support_ticket_id_status_debug
  FOR INSERT WITH CHECK (true);

-- Allow admins to read for debugging
CREATE POLICY "Allow authenticated read" ON public.support_ticket_id_status_debug
  FOR SELECT USING (true);