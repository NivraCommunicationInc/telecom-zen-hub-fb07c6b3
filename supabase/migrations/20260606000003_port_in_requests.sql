-- ============================================================
-- Port-in requests — self-service client portal
-- Stores port-in requests submitted by clients via /portal/port-in
-- Staff processes these manually by submitting to the wholesale carrier.
-- ============================================================

CREATE TABLE IF NOT EXISTS port_in_requests (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID        REFERENCES accounts(id) ON DELETE CASCADE,
  user_id                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id          UUID        REFERENCES billing_subscriptions(id) ON DELETE SET NULL,

  -- The number the client wants to bring from another carrier
  number_to_port           TEXT        NOT NULL,
  current_carrier          TEXT        NOT NULL,
  account_number_at_carrier TEXT       NOT NULL,
  pin_at_carrier           TEXT,

  -- Staff-managed fields
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'submitted', 'in_progress', 'completed', 'failed', 'cancelled')),
  notes                    TEXT,       -- client-provided notes
  staff_notes              TEXT,       -- internal staff notes
  submitted_at             TIMESTAMPTZ,  -- when staff submitted to wholesale carrier
  completed_at             TIMESTAMPTZ,

  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS: clients can see and insert their own requests; staff can see all
ALTER TABLE port_in_requests ENABLE ROW LEVEL SECURITY;

-- Clients read their own requests
CREATE POLICY "client_read_own_port_in"
  ON port_in_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Clients can insert new requests (one at a time)
CREATE POLICY "client_insert_port_in"
  ON port_in_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS (used by Edge Functions)
CREATE POLICY "service_role_all"
  ON port_in_requests FOR ALL
  USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_port_in_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_port_in_requests_updated_at ON port_in_requests;
CREATE TRIGGER trg_port_in_requests_updated_at
  BEFORE UPDATE ON port_in_requests
  FOR EACH ROW EXECUTE FUNCTION update_port_in_requests_updated_at();
