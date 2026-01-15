-- Create table for live activity tracking
CREATE TABLE public.live_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_id TEXT,
  activity_type TEXT NOT NULL,
  activity_label TEXT,
  city TEXT,
  province TEXT DEFAULT 'QC',
  postal_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy for admins/employees to read all activity
CREATE POLICY "Admins can view all live activity"
  ON public.live_activity_logs
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

-- Policy for anyone to insert activity (including anonymous)
CREATE POLICY "Anyone can insert activity"
  ON public.live_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_activity_logs;

-- Create indexes for faster queries
CREATE INDEX idx_live_activity_created_at ON public.live_activity_logs(created_at DESC);
CREATE INDEX idx_live_activity_type ON public.live_activity_logs(activity_type);
CREATE INDEX idx_live_activity_city ON public.live_activity_logs(city);

-- Auto-delete old logs after 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.live_activity_logs
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$;