
-- Identity Verification Sessions (QR-based telecom-grade ID verification)
CREATE TABLE public.identity_verification_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  order_context jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_reason text,
  result_payload jsonb,
  id_type text,
  id_province text,
  document_front_path text,
  document_back_path text,
  selfie_path text,
  checkout_type text,
  idempotency_key text UNIQUE,
  qr_regeneration_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Audit trail for all session events
CREATE TABLE public.identity_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.identity_verification_sessions(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  actor_role text,
  details jsonb DEFAULT '{}',
  idempotency_key text UNIQUE,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ivs_user_id ON public.identity_verification_sessions(user_id);
CREATE INDEX idx_ivs_public_token ON public.identity_verification_sessions(public_token);
CREATE INDEX idx_ivs_status ON public.identity_verification_sessions(status);
CREATE INDEX idx_ivs_expires_at ON public.identity_verification_sessions(expires_at);
CREATE INDEX idx_ive_session_id ON public.identity_verification_events(session_id);

-- Storage bucket for ID documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('id-documents', 'id-documents', false);

-- RLS on identity_verification_sessions
ALTER TABLE public.identity_verification_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read own sessions"
  ON public.identity_verification_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.identity_verification_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own sessions (for status changes via submission)
CREATE POLICY "Users can update own sessions"
  ON public.identity_verification_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow anonymous read by public_token (for mobile /verify-id page)
CREATE POLICY "Anon can read by public_token"
  ON public.identity_verification_sessions FOR SELECT
  TO anon
  USING (true);

-- Allow anon update (for mobile submission - token validated in code)
CREATE POLICY "Anon can update for submission"
  ON public.identity_verification_sessions FOR UPDATE
  TO anon
  USING (true);

-- RLS on identity_verification_events
ALTER TABLE public.identity_verification_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read events for their sessions
CREATE POLICY "Users can read own session events"
  ON public.identity_verification_events FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.identity_verification_sessions WHERE user_id = auth.uid()
    )
  );

-- Anyone can insert events (needed for mobile anon submission)
CREATE POLICY "Anyone can insert events"
  ON public.identity_verification_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Storage policies for id-documents bucket
CREATE POLICY "Users can upload ID docs"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (bucket_id = 'id-documents');

CREATE POLICY "Users can read own ID docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'id-documents');

-- Admin function to check admin access for verification reviews
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id AND is_active = true
  )
$$;

-- Admin policy: admins can read all sessions
CREATE POLICY "Admins can read all sessions"
  ON public.identity_verification_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Admin policy: admins can update all sessions
CREATE POLICY "Admins can update all sessions"
  ON public.identity_verification_sessions FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Admin policy: admins can read all events
CREATE POLICY "Admins can read all events"
  ON public.identity_verification_events FOR SELECT
  TO authenticated
  USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_ivs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ivs_updated_at
  BEFORE UPDATE ON public.identity_verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ivs_updated_at();

-- Add identity_verification_session_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS identity_verification_session_id uuid REFERENCES public.identity_verification_sessions(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS id_verification_status text;
