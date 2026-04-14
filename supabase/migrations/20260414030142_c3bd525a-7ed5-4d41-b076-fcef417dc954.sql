
CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text,
  stack text,
  component_stack text,
  url text,
  error_timestamp timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table (no public policies)
-- Admin staff can read errors for monitoring
CREATE POLICY "Admins can read client errors"
ON public.client_errors FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
