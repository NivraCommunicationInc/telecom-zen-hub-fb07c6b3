-- Phase 18: account_followups — staff follow-up tasks tied to a client account
CREATE TABLE IF NOT EXISTS public.account_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  account_id uuid NULL,
  title text NOT NULL,
  description text NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  due_at timestamptz NULL,
  assigned_to uuid NULL,
  assigned_to_email text NULL,
  created_by uuid NOT NULL,
  created_by_email text NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL,
  completion_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_followups_client ON public.account_followups(client_user_id);
CREATE INDEX IF NOT EXISTS idx_account_followups_status ON public.account_followups(status);
CREATE INDEX IF NOT EXISTS idx_account_followups_assigned ON public.account_followups(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_followups_due ON public.account_followups(due_at) WHERE due_at IS NOT NULL;

ALTER TABLE public.account_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view followups"
  ON public.account_followups FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'support') OR
    public.has_role(auth.uid(),'billing_admin') OR
    public.has_role(auth.uid(),'supervisor')
  );

CREATE POLICY "Staff can insert followups"
  ON public.account_followups FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'support') OR
    public.has_role(auth.uid(),'billing_admin') OR
    public.has_role(auth.uid(),'supervisor')
  );

CREATE POLICY "Staff can update followups"
  ON public.account_followups FOR UPDATE
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'support') OR
    public.has_role(auth.uid(),'billing_admin') OR
    public.has_role(auth.uid(),'supervisor')
  );

CREATE POLICY "Admins can delete followups"
  ON public.account_followups FOR DELETE
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_account_followups_updated_at
  BEFORE UPDATE ON public.account_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();