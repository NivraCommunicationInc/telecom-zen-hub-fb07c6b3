-- NPS surveys sent tracking
CREATE TABLE IF NOT EXISTS nps_surveys_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID,
  order_id UUID,
  client_email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ DEFAULT now(),
  response_score INTEGER CHECK (response_score BETWEEN 0 AND 10),
  response_comment TEXT,
  responded_at TIMESTAMPTZ
);

-- NPS responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES nps_surveys_sent(id),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  responded_at TIMESTAMPTZ DEFAULT now()
);

-- Loi 25 privacy breach incidents registry
CREATE TABLE IF NOT EXISTS privacy_breach_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  affected_records_count INTEGER DEFAULT 0,
  affected_data_types TEXT[],
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  notification_sent_at TIMESTAMPTZ,
  cai_reported_at TIMESTAMPTZ,
  remediation_steps TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CASL consent audit trail
CREATE TABLE IF NOT EXISTS consent_audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  client_email TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','push','marketing','all')),
  action TEXT NOT NULL CHECK (action IN ('opt_in','opt_out','preference_change')),
  consent_source TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_audit_client ON consent_audit_trail(client_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit_trail(created_at DESC);

-- SHA-256 hash column for contract non-repudiation
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT;

-- Retention policy: clean up sent email_queue entries older than 30 days
-- (Run via pg_cron in production)
-- SELECT cron.schedule('cleanup-email-queue', '0 3 * * *',
--   $$DELETE FROM email_queue WHERE status IN ('sent','dlq') AND created_at < NOW() - INTERVAL '30 days'$$);
