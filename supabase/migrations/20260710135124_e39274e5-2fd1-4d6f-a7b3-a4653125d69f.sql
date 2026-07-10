
DROP FUNCTION IF EXISTS public.admin_referral_reassign(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_referral_manual_reward(uuid, text, numeric, text, uuid);
DROP FUNCTION IF EXISTS public.admin_referral_clawback(uuid, text);
DROP FUNCTION IF EXISTS public.admin_referral_decide(uuid, text, text);

COMMENT ON FUNCTION public.fn_check_referral_qualification(uuid) IS
'Canonical qualification entry point (Module 33 Phase B/D). Do NOT recreate fn_track_referral_payment.';

CREATE TABLE IF NOT EXISTS public.qa_module33_e2e_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  phase TEXT NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASS','FAIL','SKIP','INFO')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_module33_e2e_log TO authenticated;
GRANT ALL ON public.qa_module33_e2e_log TO service_role;

ALTER TABLE public.qa_module33_e2e_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_module33_admin_read"
  ON public.qa_module33_e2e_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS ix_qa_module33_run ON public.qa_module33_e2e_log(run_id, created_at);
