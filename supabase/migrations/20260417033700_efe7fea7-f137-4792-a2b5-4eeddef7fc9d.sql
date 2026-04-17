-- 1) kyc_requests table
CREATE TABLE IF NOT EXISTS public.kyc_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id uuid,
  client_email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'approved', 'rejected', 'expired')),
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  rejection_reason text,
  notes text,
  document_path text,
  document_uploaded_at timestamptz,
  document_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_requests_order_id ON public.kyc_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_token ON public.kyc_requests(token);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_client_id ON public.kyc_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_status ON public.kyc_requests(status);

-- 2) Orders table additions (kyc_status may already exist; re-assert with safe defaults)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS kyc_request_id uuid REFERENCES public.kyc_requests(id);

-- Ensure kyc_status column allows our values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'kyc_status'
  ) THEN
    -- Drop any old constraint and add the canonical one
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_kyc_status_check;
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_kyc_status_check
      CHECK (kyc_status IN ('not_required', 'pending', 'completed', 'approved', 'rejected'));
  ELSE
    ALTER TABLE public.orders
      ADD COLUMN kyc_status text DEFAULT 'not_required'
      CHECK (kyc_status IN ('not_required', 'pending', 'completed', 'approved', 'rejected'));
  END IF;
END$$;

-- 3) updated_at trigger
CREATE OR REPLACE FUNCTION public.update_kyc_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_requests_updated_at ON public.kyc_requests;
CREATE TRIGGER trg_kyc_requests_updated_at
  BEFORE UPDATE ON public.kyc_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kyc_requests_updated_at();

-- 4) RLS
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

-- Admins/employees: full access via has_role()
DROP POLICY IF EXISTS "Staff can view all kyc requests" ON public.kyc_requests;
CREATE POLICY "Staff can view all kyc requests"
ON public.kyc_requests
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'employee')
  OR public.has_role(auth.uid(), 'billing_admin')
);

DROP POLICY IF EXISTS "Staff can insert kyc requests" ON public.kyc_requests;
CREATE POLICY "Staff can insert kyc requests"
ON public.kyc_requests
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'employee')
  OR public.has_role(auth.uid(), 'billing_admin')
);

DROP POLICY IF EXISTS "Staff can update kyc requests" ON public.kyc_requests;
CREATE POLICY "Staff can update kyc requests"
ON public.kyc_requests
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'employee')
  OR public.has_role(auth.uid(), 'billing_admin')
);

-- Clients can view their own KYC requests
DROP POLICY IF EXISTS "Clients can view own kyc requests" ON public.kyc_requests;
CREATE POLICY "Clients can view own kyc requests"
ON public.kyc_requests
FOR SELECT
USING (auth.uid() IS NOT NULL AND client_id = auth.uid());

-- Public token-based access is handled via SECURITY DEFINER RPCs (below), not RLS.

-- 5) Public RPCs for token-based access (SECURITY DEFINER, bypasses RLS safely)

-- Get a KYC request by its public token (for the /verification/:token page)
CREATE OR REPLACE FUNCTION public.get_kyc_request_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  client_email text,
  status text,
  expires_at timestamptz,
  completed_at timestamptz,
  order_number text,
  plan_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.order_id,
    k.client_email,
    k.status,
    k.expires_at,
    k.completed_at,
    o.order_number,
    o.service_type AS plan_name
  FROM public.kyc_requests k
  LEFT JOIN public.orders o ON o.id = k.order_id
  WHERE k.token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kyc_request_by_token(text) TO anon, authenticated;

-- Mark a KYC request as completed (called after the document is uploaded)
CREATE OR REPLACE FUNCTION public.complete_kyc_request_by_token(
  p_token text,
  p_document_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.kyc_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.kyc_requests WHERE token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_request.status NOT IN ('pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed', 'status', v_request.status);
  END IF;

  IF v_request.expires_at < now() THEN
    UPDATE public.kyc_requests SET status = 'expired' WHERE id = v_request.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  UPDATE public.kyc_requests
  SET status = 'completed',
      completed_at = now(),
      document_path = p_document_path,
      document_uploaded_at = now()
  WHERE id = v_request.id;

  UPDATE public.orders
  SET kyc_status = 'completed'
  WHERE id = v_request.order_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request.id, 'order_id', v_request.order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kyc_request_by_token(text, text) TO anon, authenticated;

-- 6) 30-day cleanup of expired/old KYC documents
CREATE OR REPLACE FUNCTION public.cleanup_expired_kyc_documents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, document_path
    FROM public.kyc_requests
    WHERE document_path IS NOT NULL
      AND document_deleted_at IS NULL
      AND completed_at IS NOT NULL
      AND completed_at < (now() - interval '30 days')
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'id-documents' AND name = r.document_path;

    UPDATE public.kyc_requests
    SET document_deleted_at = now(), document_path = NULL
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('deleted', v_count, 'ran_at', now());
END;
$$;

-- 7) Realtime
ALTER TABLE public.kyc_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'kyc_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_requests;
  END IF;
END$$;