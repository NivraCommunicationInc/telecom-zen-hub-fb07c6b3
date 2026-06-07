-- pdf_regeneration_runs: log of every admin-triggered PDF regeneration batch
CREATE TABLE IF NOT EXISTS public.pdf_regeneration_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by  UUID NOT NULL,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  total         INTEGER NOT NULL DEFAULT 0,
  succeeded     INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  log_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdf_regen_runs_triggered_at
  ON public.pdf_regeneration_runs(triggered_at DESC);

ALTER TABLE public.pdf_regeneration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage regen runs"
ON public.pdf_regeneration_runs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
