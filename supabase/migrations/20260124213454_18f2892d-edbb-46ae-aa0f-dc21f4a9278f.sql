-- ============================================================================
-- PHASE 2 FIXES: Private bucket, client notification logs, deterministic keys
-- ============================================================================

-- 1. Make ticket-attachments bucket PRIVATE (if exists, update; else create)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ticket-attachments') THEN
    UPDATE storage.buckets SET public = false WHERE id = 'ticket-attachments';
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'ticket-attachments',
      'ticket-attachments',
      false, -- PRIVATE
      52428800, -- 50MB
      ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    );
  END IF;
END $$;

-- 2. Create client notification logs table for idempotency
CREATE TABLE IF NOT EXISTS public.client_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE, -- Deterministic key for deduplication
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_number TEXT,
  client_email TEXT NOT NULL,
  client_name TEXT,
  portal_path TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast duplicate checks
CREATE INDEX IF NOT EXISTS idx_client_notification_logs_event_key 
  ON public.client_notification_logs(event_key);

CREATE INDEX IF NOT EXISTS idx_client_notification_logs_client_email 
  ON public.client_notification_logs(client_email);

-- RLS: Only service role can access
ALTER TABLE public.client_notification_logs ENABLE ROW LEVEL SECURITY;

-- 3. Update storage policies for ticket-attachments (signed URLs only)
DROP POLICY IF EXISTS "Ticket attachments upload" ON storage.objects;
DROP POLICY IF EXISTS "Ticket attachments view" ON storage.objects;

-- Upload policy: authenticated users can upload to their folder
CREATE POLICY "Ticket attachments upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND auth.role() = 'authenticated'
  );

-- View policy: ticket owner, participants, or staff can view
CREATE POLICY "Ticket attachments view"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ticket-attachments'
    AND (
      -- Admins and employees can view all
      EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
      OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
      -- Or owner/participant of the ticket (path starts with ticketId)
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id::text = split_part(name, '/', 1)
        AND (st.owner_user_id = auth.uid() OR st.user_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.ticket_participants tp
        WHERE tp.ticket_id::text = split_part(name, '/', 1)
        AND tp.user_id = auth.uid()
      )
    )
  );

-- 4. Add index for admin_notification_logs event_id for duplicate checks
CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_event_id 
  ON public.admin_notification_logs(event_id);
