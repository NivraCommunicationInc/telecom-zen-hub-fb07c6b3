-- 1) Create client_internal_notes table
CREATE TABLE public.client_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('admin', 'employee')),
  body TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_by_role TEXT NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_internal_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Admin and Employee can access
CREATE POLICY "Admins can manage all internal notes"
  ON public.client_internal_notes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage internal notes"
  ON public.client_internal_notes
  FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_client_internal_notes_client_id ON public.client_internal_notes(client_id);
CREATE INDEX idx_client_internal_notes_created_at ON public.client_internal_notes(created_at DESC);

-- 2) Add ID upload fields to support_tickets table
ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS requires_id_upload BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT DEFAULT 'not_received' CHECK (id_verification_status IN ('not_received', 'received', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS id_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- 3) Create storage bucket for ID uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ticket-id-uploads', 'ticket-id-uploads', false, 15728640)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ticket-id-uploads bucket
CREATE POLICY "Clients can upload their own ID files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ticket-id-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients can view their own ID files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ticket-id-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can manage all ticket ID files"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'ticket-id-uploads' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Employees can view all ticket ID files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ticket-id-uploads' 
    AND has_role(auth.uid(), 'employee'::app_role)
  );