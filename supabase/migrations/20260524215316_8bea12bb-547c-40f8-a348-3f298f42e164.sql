
-- Fraud incidents log
CREATE TABLE public.account_fraud_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  account_id UUID,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  risk_score_delta INTEGER NOT NULL DEFAULT 0,
  resolution_notes TEXT,
  internal_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_by_email TEXT,
  last_updated_by UUID,
  last_updated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fraud_severity_check CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT fraud_status_check CHECK (status IN ('open','investigating','resolved','false_positive','escalated'))
);

CREATE INDEX idx_account_fraud_incidents_client ON public.account_fraud_incidents(client_id, detected_at DESC);
CREATE INDEX idx_account_fraud_incidents_status ON public.account_fraud_incidents(status) WHERE status IN ('open','investigating','escalated');

ALTER TABLE public.account_fraud_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view fraud incidents"
  ON public.account_fraud_incidents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
  );

CREATE POLICY "Staff can insert fraud incidents"
  ON public.account_fraud_incidents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
  );

CREATE POLICY "Staff can update fraud incidents"
  ON public.account_fraud_incidents FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
  );

CREATE TRIGGER set_fraud_incidents_updated_at
  BEFORE UPDATE ON public.account_fraud_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Risk scores (one row per client)
CREATE TABLE public.account_risk_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE,
  account_id UUID,
  current_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  last_assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_assessed_by UUID,
  last_assessed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT risk_score_range CHECK (current_score >= 0 AND current_score <= 100),
  CONSTRAINT risk_level_check CHECK (risk_level IN ('low','medium','high','critical'))
);

ALTER TABLE public.account_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view risk scores"
  ON public.account_risk_scores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
  );

CREATE POLICY "Staff can upsert risk scores"
  ON public.account_risk_scores FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
    OR public.has_role(auth.uid(),'employee')
  );

CREATE POLICY "Staff can update risk scores"
  ON public.account_risk_scores FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'support')
    OR public.has_role(auth.uid(),'employee')
  );

CREATE TRIGGER set_risk_scores_updated_at
  BEFORE UPDATE ON public.account_risk_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
