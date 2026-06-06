-- ============================================================================
-- TELECOM INFRASTRUCTURE — DID Inventory + Provisioning Queue + Network
-- ============================================================================

-- ── 1. DID / Phone number inventory ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.did_numbers (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number                    TEXT NOT NULL UNIQUE,           -- E.164: +15141234567
  number_type               TEXT NOT NULL DEFAULT 'local',  -- local, mobile, toll_free
  area_code                 TEXT,
  province                  TEXT DEFAULT 'QC',
  carrier                   TEXT,                           -- Bell, Telus, Rogers, VoIP.ms…
  status                    TEXT NOT NULL DEFAULT 'available',
    -- available | assigned | ported_in | ported_out | reserved | decommissioned
  assigned_to_customer_id   UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  assigned_to_order_id      UUID REFERENCES public.orders(id)            ON DELETE SET NULL,
  assigned_at               TIMESTAMPTZ,
  monthly_cost              NUMERIC(10,2) DEFAULT 0,        -- what Nivra pays carrier
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_did_numbers_status   ON public.did_numbers(status);
CREATE INDEX IF NOT EXISTS idx_did_numbers_customer ON public.did_numbers(assigned_to_customer_id);
CREATE INDEX IF NOT EXISTS idx_did_numbers_area     ON public.did_numbers(area_code);

ALTER TABLE public.did_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_full_did_numbers" ON public.did_numbers
  USING (public.is_portal_projection_staff(auth.uid()));

-- ── 2. Carrier provisioning queue ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provisioning_queue (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              UUID REFERENCES public.orders(id)            ON DELETE SET NULL,
  customer_id           UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  did_number_id         UUID REFERENCES public.did_numbers(id)       ON DELETE SET NULL,
  action                TEXT NOT NULL,
    -- activate_sim | port_in | port_out | deactivate | number_assign
  status                TEXT NOT NULL DEFAULT 'pending',
    -- pending | submitted | confirmed | failed | cancelled
  carrier               TEXT,
  carrier_reference_id  TEXT,
  submitted_at          TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT,
  payload               JSONB DEFAULT '{}',  -- carrier-specific fields (SIM ICCID, port-in data, etc.)
  assigned_by           UUID,                -- staff user who created the task
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_status    ON public.provisioning_queue(status);
CREATE INDEX IF NOT EXISTS idx_provisioning_order     ON public.provisioning_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_customer  ON public.provisioning_queue(customer_id);

ALTER TABLE public.provisioning_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_full_provisioning" ON public.provisioning_queue
  USING (public.is_portal_projection_staff(auth.uid()));

-- ── 3. Network incidents (manual + automated) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.network_incidents (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title               TEXT NOT NULL,
  incident_type       TEXT NOT NULL DEFAULT 'degraded',
    -- degraded | partial_outage | major_outage | maintenance
  status              TEXT NOT NULL DEFAULT 'investigating',
    -- investigating | identified | monitoring | resolved
  affected_services   TEXT[] DEFAULT '{}',
  severity            TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_incidents_status  ON public.network_incidents(status);
CREATE INDEX IF NOT EXISTS idx_network_incidents_started ON public.network_incidents(started_at DESC);

ALTER TABLE public.network_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_full_incidents" ON public.network_incidents
  USING (public.is_portal_projection_staff(auth.uid()));

-- ── 4. Uptime check log (written by edge function every 5 min) ───────────────
CREATE TABLE IF NOT EXISTS public.network_uptime_checks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_name    TEXT NOT NULL,
  endpoint_url     TEXT,
  is_up            BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  http_status      INTEGER,
  error_message    TEXT,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep only 7 days of check history
CREATE INDEX IF NOT EXISTS idx_uptime_checks_time     ON public.network_uptime_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_endpoint ON public.network_uptime_checks(endpoint_name, checked_at DESC);

ALTER TABLE public.network_uptime_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_uptime" ON public.network_uptime_checks
  FOR SELECT USING (public.is_portal_projection_staff(auth.uid()));
CREATE POLICY "service_role_write_uptime" ON public.network_uptime_checks
  FOR INSERT WITH CHECK (true);  -- edge function uses service role

-- ── 5. Auto-cleanup uptime checks older than 7 days ─────────────────────────
SELECT cron.schedule(
  'cleanup-uptime-checks',
  '0 3 * * *',
  $$DELETE FROM public.network_uptime_checks WHERE checked_at < now() - interval '7 days'$$
);
