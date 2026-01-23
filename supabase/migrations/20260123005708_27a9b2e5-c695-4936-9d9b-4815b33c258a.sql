-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client documents bucket
CREATE POLICY "Clients can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients can view their own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all client documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Admins can upload documents for clients"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Create table for document requests (links from emails)
CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticket_id UUID REFERENCES public.support_tickets(id),
  request_token TEXT NOT NULL UNIQUE,
  required_documents JSONB NOT NULL DEFAULT '[]',
  request_reason TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Policies for document requests
CREATE POLICY "Users can view their own document requests"
ON public.document_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage document requests"
ON public.document_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Create index for token lookup
CREATE INDEX idx_document_requests_token ON public.document_requests(request_token);

-- Add realtime for document requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_requests;