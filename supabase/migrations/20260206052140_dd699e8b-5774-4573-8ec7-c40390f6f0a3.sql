-- Create bucket for public documents (terms of service, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to documents bucket
CREATE POLICY "Public read access for documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents');
