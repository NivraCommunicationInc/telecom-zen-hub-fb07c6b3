CREATE TABLE IF NOT EXISTS public.speedtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  download_mbps NUMERIC(10,2),
  upload_mbps NUMERIC(10,2),
  latency_ms INTEGER,
  server TEXT NOT NULL DEFAULT 'Nivra Telecom — Montréal QC',
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_speedtest_results_user ON public.speedtest_results(user_id, tested_at DESC);

ALTER TABLE public.speedtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own speedtest results"
ON public.speedtest_results FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own speedtest results"
ON public.speedtest_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all speedtest results"
ON public.speedtest_results FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));