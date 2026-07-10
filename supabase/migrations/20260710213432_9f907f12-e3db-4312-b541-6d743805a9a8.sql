
-- =========================================================================
-- MODULE 39 — PHASE A : hardening des tables documents (single-door)
-- =========================================================================

-- ---------- 1. AUDIT & IDEMPOTENCY -----------------------------------------
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_table TEXT NOT NULL,
  document_id UUID,
  action TEXT NOT NULL,                     -- upload|download|delete|restore|purge|request_fulfilled
  actor_id UUID,
  actor_role TEXT,
  target_user_id UUID,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  before_state JSONB,
  after_state JSONB,
  edge_function TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_audit_doc ON public.document_audit_log(document_table, document_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_actor ON public.document_audit_log(actor_id, created_at DESC);

GRANT SELECT ON public.document_audit_log TO authenticated;
GRANT ALL ON public.document_audit_log TO service_role;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view doc audit" ON public.document_audit_log;
CREATE POLICY "Staff view doc audit" ON public.document_audit_log FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'employee'::app_role)
  OR has_role(auth.uid(),'supervisor'::app_role)
  OR has_role(auth.uid(),'billing_admin'::app_role)
  OR actor_id = auth.uid()
  OR target_user_id = auth.uid()
);

CREATE TABLE IF NOT EXISTS public.document_action_idempotency (
  idempotency_key UUID PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID,
  request_hash TEXT NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_doc_idem_exp ON public.document_action_idempotency(expires_at);
GRANT ALL ON public.document_action_idempotency TO service_role;
ALTER TABLE public.document_action_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all idem" ON public.document_action_idempotency;
CREATE POLICY "Deny all idem" ON public.document_action_idempotency FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ---------- 2. HARDENING COLUMNS -------------------------------------------
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '3 years'),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS edge_function TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '3 years'),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS edge_function TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

ALTER TABLE public.hr_documents
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 years'),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS edge_function TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

ALTER TABLE public.client_auto_documents
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '2 years'),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS edge_function TEXT;

-- ---------- 3. VALIDATION TRIGGER (MIME + size) ----------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_document_payload()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_mime TEXT;
  v_size BIGINT;
  v_allowed TEXT[] := ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic'];
BEGIN
  v_mime := COALESCE(NEW.mime_type, '');
  BEGIN v_size := NEW.file_size_bytes; EXCEPTION WHEN OTHERS THEN v_size := NULL; END;

  -- HR uses mime_type + file_size (different column name)
  IF TG_TABLE_NAME = 'hr_documents' THEN
    v_mime := COALESCE(NEW.mime_type, '');
    v_size := COALESCE(NEW.file_size::BIGINT, 0);
  END IF;

  IF v_mime IS NOT NULL AND v_mime <> '' AND NOT (v_mime = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'DOCUMENT-MIME-INVALID: % non autorisé', v_mime USING ERRCODE='check_violation';
  END IF;
  IF v_size IS NOT NULL AND v_size > 20 * 1024 * 1024 THEN
    RAISE EXCEPTION 'DOCUMENT-SIZE-EXCEEDED: % octets > 20 MiB', v_size USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END; $$;

-- ---------- 4. SINGLE-DOOR GUARD TRIGGER -----------------------------------
CREATE OR REPLACE FUNCTION public.fn_documents_single_door_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claim.role', true);
  v_current TEXT := current_user;
BEGIN
  -- service_role (Edge Functions canoniques) OU superuser (migrations) OU postgres bypass
  IF v_current IN ('postgres','supabase_admin','service_role') OR v_role = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'DOCUMENT-SINGLE-DOOR: écriture directe interdite sur %. Utiliser Edge Function canonique.', TG_TABLE_NAME
    USING ERRCODE='insufficient_privilege';
END; $$;

-- attach triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_documents','order_documents','hr_documents','client_auto_documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_documents_single_door ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tg_documents_single_door BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_documents_single_door_guard()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS tg_documents_validate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tg_documents_validate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_validate_document_payload()', t);
  END LOOP;
END $$;

-- ---------- 5. RLS : lecture propriétaire/staff, écritures fermées ---------
-- client_documents
DROP POLICY IF EXISTS "Staff can manage all documents" ON public.client_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.client_documents;
DROP POLICY IF EXISTS "Users can view own client_documents" ON public.client_documents;
CREATE POLICY "Users view own client_documents" ON public.client_documents FOR SELECT TO authenticated
USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "Staff view all client_documents" ON public.client_documents FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- order_documents
DROP POLICY IF EXISTS "Admins can manage all order documents" ON public.order_documents;
DROP POLICY IF EXISTS "Employees can manage order documents" ON public.order_documents;
DROP POLICY IF EXISTS "Users can create their own order documents" ON public.order_documents;
DROP POLICY IF EXISTS "Users can view their own order documents" ON public.order_documents;
CREATE POLICY "Users view own order_documents" ON public.order_documents FOR SELECT TO authenticated
USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()) AND deleted_at IS NULL);
CREATE POLICY "Staff view all order_documents" ON public.order_documents FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- hr_documents
DROP POLICY IF EXISTS "Admins manage all hr_documents" ON public.hr_documents;
DROP POLICY IF EXISTS "Employees insert own hr_documents" ON public.hr_documents;
DROP POLICY IF EXISTS "Employees view own hr_documents" ON public.hr_documents;
CREATE POLICY "Employees view own hr_documents" ON public.hr_documents FOR SELECT TO authenticated
USING (employee_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "HR staff view all hr_documents" ON public.hr_documents FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

-- client_auto_documents: existing SELECT policies preserved, but ensure deleted_at hidden
DROP POLICY IF EXISTS "Clients view own auto documents" ON public.client_auto_documents;
CREATE POLICY "Clients view own auto documents" ON public.client_auto_documents FOR SELECT TO authenticated
USING (client_id = auth.uid() AND deleted_at IS NULL);

-- ---------- 6. RPC canoniques ---------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_document_register(
  p_table TEXT,
  p_payload JSONB,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_reason TEXT,
  p_idempotency_key UUID,
  p_ip TEXT,
  p_ua TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_id UUID;
  v_result JSONB;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_result FROM document_action_idempotency
      WHERE idempotency_key = p_idempotency_key AND expires_at > now();
    IF FOUND THEN RETURN jsonb_build_object('ok', true, 'idempotent_replay', true, 'data', v_result); END IF;
  END IF;

  IF p_table = 'client_documents' THEN
    INSERT INTO client_documents (user_id, document_name, document_url, document_type, uploaded_by,
      sha256_hash, mime_type, file_size_bytes, edge_function, idempotency_key)
    VALUES (
      (p_payload->>'user_id')::uuid, p_payload->>'document_name', p_payload->>'document_url',
      p_payload->>'document_type', p_actor_id,
      p_payload->>'sha256_hash', p_payload->>'mime_type', (p_payload->>'file_size_bytes')::bigint,
      'account-document-manage', p_idempotency_key
    ) RETURNING id INTO v_id;
  ELSIF p_table = 'order_documents' THEN
    INSERT INTO order_documents (order_id, doc_type, file_name, pdf_url,
      sha256_hash, mime_type, file_size_bytes, edge_function, idempotency_key)
    VALUES (
      (p_payload->>'order_id')::uuid, p_payload->>'doc_type', p_payload->>'file_name', p_payload->>'pdf_url',
      p_payload->>'sha256_hash', p_payload->>'mime_type', (p_payload->>'file_size_bytes')::bigint,
      'account-document-manage', p_idempotency_key
    ) RETURNING id INTO v_id;
  ELSIF p_table = 'hr_documents' THEN
    INSERT INTO hr_documents (employee_id, uploaded_by, document_type, title, file_path, file_size, mime_type, status,
      sha256_hash, edge_function, idempotency_key)
    VALUES (
      (p_payload->>'employee_id')::uuid, p_actor_id, p_payload->>'document_type', p_payload->>'title',
      p_payload->>'file_path', (p_payload->>'file_size')::int, p_payload->>'mime_type',
      COALESCE(p_payload->>'status','pending'),
      p_payload->>'sha256_hash', 'hr-document-manage', p_idempotency_key
    ) RETURNING id INTO v_id;
  ELSE
    RAISE EXCEPTION 'DOCUMENT-TABLE-UNKNOWN: %', p_table;
  END IF;

  INSERT INTO document_audit_log (document_table, document_id, action, actor_id, actor_role, target_user_id,
    reason, ip_address, user_agent, after_state, edge_function, idempotency_key)
  VALUES (p_table, v_id, 'upload', p_actor_id, p_actor_role, (p_payload->>'user_id')::uuid,
    p_reason, p_ip, p_ua, p_payload, 'account-document-manage', p_idempotency_key::text);

  v_result := jsonb_build_object('id', v_id);
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO document_action_idempotency (idempotency_key, action, actor_id, request_hash, response)
    VALUES (p_idempotency_key, 'register:'||p_table, p_actor_id, md5(p_payload::text), v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'data', v_result);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_document_soft_delete(
  p_table TEXT, p_id UUID, p_actor_id UUID, p_actor_role TEXT, p_reason TEXT, p_ip TEXT, p_ua TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before JSONB;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'DOCUMENT-REASON-REQUIRED';
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1', p_table) INTO v_before USING p_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'DOCUMENT-NOT-FOUND'; END IF;
  EXECUTE format('UPDATE public.%I SET deleted_at=now(), deleted_by=$2, deletion_reason=$3 WHERE id=$1', p_table)
    USING p_id, p_actor_id, p_reason;
  INSERT INTO document_audit_log (document_table, document_id, action, actor_id, actor_role, reason, ip_address, user_agent, before_state, edge_function)
  VALUES (p_table, p_id, 'delete', p_actor_id, p_actor_role, p_reason, p_ip, p_ua, v_before, 'account-document-manage');
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_document_register(TEXT,JSONB,UUID,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.rpc_document_soft_delete(TEXT,UUID,UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_document_register(TEXT,JSONB,UUID,TEXT,TEXT,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_document_soft_delete(TEXT,UUID,UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- ---------- 7. STORAGE : révoquer écritures directes ----------------------
DROP POLICY IF EXISTS "Users upload client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload order-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload hr-documents" ON storage.objects;

-- (Reads remain governed by existing policies; writes now require service_role which bypasses RLS.)
