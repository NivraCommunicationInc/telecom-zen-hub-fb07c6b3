-- Private admin-only notes per client (Account 360)
CREATE TABLE IF NOT EXISTS public.client_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_admin_notes_client ON public.client_admin_notes(client_id, created_at DESC);

ALTER TABLE public.client_admin_notes ENABLE ROW LEVEL SECURITY;

-- Deny anon explicitly
DROP POLICY IF EXISTS "deny_anon_client_admin_notes" ON public.client_admin_notes;
CREATE POLICY "deny_anon_client_admin_notes"
  ON public.client_admin_notes
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Admin-only access (read/write/delete)
DROP POLICY IF EXISTS "admin_only_client_admin_notes_select" ON public.client_admin_notes;
CREATE POLICY "admin_only_client_admin_notes_select"
  ON public.client_admin_notes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_only_client_admin_notes_insert" ON public.client_admin_notes;
CREATE POLICY "admin_only_client_admin_notes_insert"
  ON public.client_admin_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "admin_only_client_admin_notes_update" ON public.client_admin_notes;
CREATE POLICY "admin_only_client_admin_notes_update"
  ON public.client_admin_notes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_only_client_admin_notes_delete" ON public.client_admin_notes;
CREATE POLICY "admin_only_client_admin_notes_delete"
  ON public.client_admin_notes
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_client_admin_notes_updated_at ON public.client_admin_notes;
CREATE TRIGGER trg_client_admin_notes_updated_at
  BEFORE UPDATE ON public.client_admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();