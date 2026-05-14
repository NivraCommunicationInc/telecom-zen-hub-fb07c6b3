
CREATE TABLE IF NOT EXISTS public.field_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  agent_name TEXT,
  intent_id UUID REFERENCES public.field_payment_intents(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB DEFAULT '[]'::jsonb,
  discount JSONB DEFAULT '{}'::jsonb,
  subtotal NUMERIC(10,2),
  tps NUMERIC(10,2),
  tvq NUMERIC(10,2),
  total NUMERIC(10,2) NOT NULL,
  payment_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_client'
    CHECK (status IN ('pending_client','completed','expired','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  email_sent_count INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_submissions_agent ON public.field_submissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_field_submissions_status ON public.field_submissions(status);
CREATE INDEX IF NOT EXISTS idx_field_submissions_expires ON public.field_submissions(expires_at);

ALTER TABLE public.field_submissions ENABLE ROW LEVEL SECURITY;

-- Agent can view their own submissions
DROP POLICY IF EXISTS "agent_select_own_submissions" ON public.field_submissions;
CREATE POLICY "agent_select_own_submissions" ON public.field_submissions
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Agent can create submissions tied to themselves
DROP POLICY IF EXISTS "agent_insert_own_submissions" ON public.field_submissions;
CREATE POLICY "agent_insert_own_submissions" ON public.field_submissions
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Admins can view/update all
DROP POLICY IF EXISTS "admin_select_all_submissions" ON public.field_submissions;
CREATE POLICY "admin_select_all_submissions" ON public.field_submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_update_all_submissions" ON public.field_submissions;
CREATE POLICY "admin_update_all_submissions" ON public.field_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public read by id for /payer/ page (anon can SELECT — id is opaque UUID)
DROP POLICY IF EXISTS "public_select_submissions" ON public.field_submissions;
CREATE POLICY "public_select_submissions" ON public.field_submissions
  FOR SELECT TO anon
  USING (status = 'pending_client' AND expires_at > now());
