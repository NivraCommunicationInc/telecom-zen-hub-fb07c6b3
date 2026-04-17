
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'activation_wifi_key') THEN
    v_key := encode(digest(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'base64');
    PERFORM vault.create_secret(v_key, 'activation_wifi_key', 'Encryption key for WiFi passwords in activation_requests');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  order_id uuid,
  wifi_network_name text NOT NULL,
  wifi_password_encrypted bytea NOT NULL,
  contact_phone text NOT NULL,
  client_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','activating','activated','client_confirming','completed','technician_required','rejected','cancelled')),
  assigned_to uuid,
  admin_notes text,
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  business_notified boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activation_requests_client ON public.activation_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_status ON public.activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_activation_requests_submitted ON public.activation_requests(submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.activation_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_request_id uuid NOT NULL REFERENCES public.activation_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_history_request ON public.activation_request_history(activation_request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_activation_requests_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status <> NEW.status THEN
      IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
      IF NEW.status = 'activated' AND NEW.activated_at IS NULL THEN NEW.activated_at := now(); END IF;
      IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activation_requests_updated_at ON public.activation_requests;
CREATE TRIGGER trg_activation_requests_updated_at
BEFORE UPDATE ON public.activation_requests
FOR EACH ROW EXECUTE FUNCTION public.set_activation_requests_updated_at();

CREATE OR REPLACE FUNCTION public.log_activation_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_role text; v_actor_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activation_request_history (activation_request_id, from_status, to_status, actor_user_id, actor_role, actor_name, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.client_id, 'client', NULL, 'Demande créée');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_actor_role := NULL; END;
    BEGIN SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;
    INSERT INTO public.activation_request_history (activation_request_id, from_status, to_status, actor_user_id, actor_role, actor_name, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), COALESCE(v_actor_role, 'system'), v_actor_name, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activation_status_change ON public.activation_requests;
CREATE TRIGGER trg_activation_status_change
AFTER INSERT OR UPDATE ON public.activation_requests
FOR EACH ROW EXECUTE FUNCTION public.log_activation_status_change();

CREATE OR REPLACE FUNCTION public.encrypt_wifi_password(p_password text)
RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_key text;
BEGIN
  IF p_password IS NULL OR length(p_password) = 0 THEN RAISE EXCEPTION 'Password cannot be empty'; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'activation_wifi_key' LIMIT 1;
  IF v_key IS NULL THEN RAISE EXCEPTION 'Encryption key missing'; END IF;
  RETURN pgp_sym_encrypt(p_password, v_key);
END $$;

CREATE OR REPLACE FUNCTION public.decrypt_wifi_password(p_encrypted bytea)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_key text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'supervisor') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'support')
  ) THEN
    RAISE EXCEPTION 'Not authorized to decrypt WiFi passwords';
  END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'activation_wifi_key' LIMIT 1;
  RETURN pgp_sym_decrypt(p_encrypted, v_key);
END $$;

CREATE OR REPLACE FUNCTION public.submit_activation_request(
  p_wifi_network_name text, p_wifi_password text, p_contact_phone text,
  p_client_notes text DEFAULT NULL, p_order_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_wifi_network_name IS NULL OR length(trim(p_wifi_network_name)) = 0 OR length(p_wifi_network_name) > 32 THEN
    RAISE EXCEPTION 'Invalid WiFi network name';
  END IF;
  IF p_wifi_password IS NULL OR length(p_wifi_password) < 8 THEN
    RAISE EXCEPTION 'WiFi password must be at least 8 characters';
  END IF;
  IF p_contact_phone IS NULL OR length(trim(p_contact_phone)) < 7 THEN
    RAISE EXCEPTION 'Invalid contact phone';
  END IF;
  INSERT INTO public.activation_requests (client_id, order_id, wifi_network_name, wifi_password_encrypted, contact_phone, client_notes)
  VALUES (v_user_id, p_order_id, p_wifi_network_name, public.encrypt_wifi_password(p_wifi_password), p_contact_phone, p_client_notes)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_activation_request(text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_wifi_password(bytea) TO authenticated;

ALTER TABLE public.activation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_request_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own activation requests" ON public.activation_requests;
CREATE POLICY "Clients view own activation requests" ON public.activation_requests FOR SELECT TO authenticated USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients insert own activation requests" ON public.activation_requests;
CREATE POLICY "Clients insert own activation requests" ON public.activation_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients update own activation requests" ON public.activation_requests;
CREATE POLICY "Clients update own activation requests" ON public.activation_requests FOR UPDATE TO authenticated USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Staff view all activation requests" ON public.activation_requests;
CREATE POLICY "Staff view all activation requests" ON public.activation_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'billing_admin') OR public.has_role(auth.uid(),'support'));

DROP POLICY IF EXISTS "Staff update all activation requests" ON public.activation_requests;
CREATE POLICY "Staff update all activation requests" ON public.activation_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'billing_admin') OR public.has_role(auth.uid(),'support'));

DROP POLICY IF EXISTS "Clients view own activation history" ON public.activation_request_history;
CREATE POLICY "Clients view own activation history" ON public.activation_request_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.activation_requests ar WHERE ar.id = activation_request_id AND ar.client_id = auth.uid()));

DROP POLICY IF EXISTS "Staff view all activation history" ON public.activation_request_history;
CREATE POLICY "Staff view all activation history" ON public.activation_request_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'billing_admin') OR public.has_role(auth.uid(),'support'));

ALTER TABLE public.activation_requests REPLICA IDENTITY FULL;
ALTER TABLE public.activation_request_history REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activation_requests') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activation_requests';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activation_request_history') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activation_request_history';
  END IF;
END $$;
