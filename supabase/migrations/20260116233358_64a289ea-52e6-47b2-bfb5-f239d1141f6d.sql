-- Fix last remaining USING(true) warning on live_activity_logs
-- Add minimal condition: user can only insert their own activity

DROP POLICY IF EXISTS "Authenticated users can insert activity" ON public.live_activity_logs;

CREATE POLICY "Authenticated users can insert their own activity"
ON public.live_activity_logs FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can only insert logs for themselves or without user_id
  user_id IS NULL OR user_id = auth.uid()
);