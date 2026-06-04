-- CRM lead scoring
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS lead_category TEXT CHECK (lead_category IN ('hot','warm','cold'));
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_crm_lead_score ON crm_contacts(lead_score DESC);

-- Work orders for technicians
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID,
  technician_id UUID,
  work_type TEXT NOT NULL CHECK (work_type IN ('installation','repair','upgrade','disconnection')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_orders_technician ON work_orders(technician_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- SLA violations tracking
CREATE TABLE IF NOT EXISTS sla_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES work_orders(id),
  hours_overdue NUMERIC,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Porting requests
CREATE TABLE IF NOT EXISTS porting_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID,
  phone_number TEXT NOT NULL,
  current_provider TEXT,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated','submitted','in_progress','completed','failed','cancelled')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRTC compliance reports
CREATE TABLE IF NOT EXISTS crtc_compliance_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  metrics JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'generated',
  UNIQUE(year, quarter)
);

-- pg_cron: email queue cleanup (run this in Supabase SQL editor)
-- SELECT cron.schedule('cleanup-email-queue', '0 3 * * *',
--   $$DELETE FROM email_queue WHERE status IN (''sent'',''dlq'') AND created_at < NOW() - INTERVAL ''30 days''$$);
-- SELECT cron.schedule('cleanup-agent-events', '0 4 * * *',
--   $$DELETE FROM agent_events WHERE created_at < NOW() - INTERVAL ''60 days''$$);
-- SELECT cron.schedule('cleanup-agent-audit', '0 4 * * *',
--   $$DELETE FROM agent_audit_log WHERE created_at < NOW() - INTERVAL ''90 days''$$);
