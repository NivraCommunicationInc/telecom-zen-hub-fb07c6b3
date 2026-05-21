CREATE SEQUENCE IF NOT EXISTS public.support_ai_seq START 1;

CREATE TABLE IF NOT EXISTS public.support_tickets_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT (
    'SUP-' || to_char(now(), 'YYYY') || '-' ||
    LPAD(nextval('public.support_ai_seq')::TEXT, 5, '0')
  ),
  source TEXT CHECK (source IN ('email','chat','portal','phone','agent_submitted')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category TEXT CHECK (category IN ('billing','technical','account','installation','equipment','cancellation','complaint','information','other')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','frustrated','angry','urgent')),
  ai_confidence DECIMAL(3,2),
  ai_response TEXT,
  ai_response_sent BOOLEAN DEFAULT false,
  ai_escalated BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','ai_responded','escalated','in_progress','resolved','closed')),
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_status ON public.support_tickets_ai(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_account ON public.support_tickets_ai(account_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_created ON public.support_tickets_ai(created_at DESC);

ALTER TABLE public.support_tickets_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all support tickets"
  ON public.support_tickets_ai FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees manage all support tickets"
  ON public.support_tickets_ai FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients read own support tickets"
  ON public.support_tickets_ai FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.accounts WHERE client_id = auth.uid())
  );

CREATE TRIGGER trg_support_tickets_ai_updated_at
  BEFORE UPDATE ON public.support_tickets_ai
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();