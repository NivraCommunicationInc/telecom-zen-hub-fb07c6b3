-- 1. Nouvelle table dédiée aux documents auto-générés
CREATE TABLE IF NOT EXISTS public.client_auto_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID,
  client_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  doc_number TEXT,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_message_id TEXT,
  recipient_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_auto_documents_idempotency ON public.client_auto_documents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_client_auto_documents_account ON public.client_auto_documents(account_id);
CREATE INDEX IF NOT EXISTS idx_client_auto_documents_client ON public.client_auto_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_auto_documents_doc_type ON public.client_auto_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_client_auto_documents_created ON public.client_auto_documents(created_at DESC);

CREATE OR REPLACE FUNCTION public.update_client_auto_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_auto_documents_updated_at ON public.client_auto_documents;
CREATE TRIGGER trg_client_auto_documents_updated_at
  BEFORE UPDATE ON public.client_auto_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_client_auto_documents_updated_at();

ALTER TABLE public.client_auto_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own auto documents" ON public.client_auto_documents;
CREATE POLICY "Clients view own auto documents"
ON public.client_auto_documents
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Staff view all auto documents" ON public.client_auto_documents;
CREATE POLICY "Staff view all auto documents"
ON public.client_auto_documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'employee') OR
  public.has_role(auth.uid(), 'billing_admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

DROP POLICY IF EXISTS "Deny anonymous auto documents" ON public.client_auto_documents;
CREATE POLICY "Deny anonymous auto documents"
ON public.client_auto_documents
FOR ALL
TO anon
USING (false);

-- 2. Storage policies sur le bucket existant 'client-documents'
DROP POLICY IF EXISTS "Clients read own client-documents files" ON storage.objects;
CREATE POLICY "Clients read own client-documents files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Staff read all client-documents files" ON storage.objects;
CREATE POLICY "Staff read all client-documents files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  )
);