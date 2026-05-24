
-- Phase 3: Internet account management tables
-- Tables to track Internet service operations for client account management

-- ============================================================
-- 1. Internet plan changes
CREATE TABLE public.internet_plan_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  subscription_id UUID NULL,
  previous_plan_name TEXT NULL,
  previous_monthly_price NUMERIC(10,2) NULL,
  previous_speed_mbps INTEGER NULL,
  new_plan_name TEXT NOT NULL,
  new_monthly_price NUMERIC(10,2) NOT NULL,
  new_speed_mbps INTEGER NULL,
  change_type TEXT NOT NULL DEFAULT 'upgrade',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed',
  reason TEXT NULL,
  performed_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_internet_plan_changes_user ON public.internet_plan_changes(user_id, created_at DESC);
ALTER TABLE public.internet_plan_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internet_plan_changes_client_select"
ON public.internet_plan_changes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "internet_plan_changes_staff_all"
ON public.internet_plan_changes FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
);

-- ============================================================
-- 2. Modem / router remote actions
CREATE TABLE public.internet_modem_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  subscription_id UUID NULL,
  modem_serial TEXT NULL,
  modem_mac TEXT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  reason TEXT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_internet_modem_actions_user ON public.internet_modem_actions(user_id, created_at DESC);
ALTER TABLE public.internet_modem_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internet_modem_actions_client_select"
ON public.internet_modem_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "internet_modem_actions_staff_all"
ON public.internet_modem_actions FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
);

-- ============================================================
-- 3. Line diagnostics history
CREATE TABLE public.internet_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  subscription_id UUID NULL,
  diagnostic_type TEXT NOT NULL DEFAULT 'full',
  link_status TEXT NULL,
  signal_strength_db NUMERIC(5,2) NULL,
  download_mbps NUMERIC(8,2) NULL,
  upload_mbps NUMERIC(8,2) NULL,
  latency_ms NUMERIC(7,2) NULL,
  packet_loss_pct NUMERIC(5,2) NULL,
  notes TEXT NULL,
  raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_internet_diagnostics_user ON public.internet_diagnostics(user_id, created_at DESC);
ALTER TABLE public.internet_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internet_diagnostics_client_select"
ON public.internet_diagnostics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "internet_diagnostics_staff_all"
ON public.internet_diagnostics FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
);

-- ============================================================
-- 4. WiFi settings (SSID, password, band, guest network)
CREATE TABLE public.internet_wifi_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  account_id UUID NULL,
  ssid_24 TEXT NULL,
  ssid_5 TEXT NULL,
  password_hint TEXT NULL,
  band_mode TEXT NOT NULL DEFAULT 'dual',
  guest_enabled BOOLEAN NOT NULL DEFAULT false,
  guest_ssid TEXT NULL,
  guest_password_hint TEXT NULL,
  channel_24 INTEGER NULL,
  channel_5 INTEGER NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.internet_wifi_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internet_wifi_settings_client_select"
ON public.internet_wifi_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "internet_wifi_settings_staff_all"
ON public.internet_wifi_settings FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
);

CREATE TRIGGER trg_internet_wifi_settings_updated_at
BEFORE UPDATE ON public.internet_wifi_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Static IP assignments
CREATE TABLE public.internet_static_ip_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NULL,
  subscription_id UUID NULL,
  ip_address TEXT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ NULL,
  released_at TIMESTAMPTZ NULL,
  released_reason TEXT NULL,
  performed_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_internet_static_ip_user ON public.internet_static_ip_assignments(user_id, created_at DESC);
ALTER TABLE public.internet_static_ip_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internet_static_ip_client_select"
ON public.internet_static_ip_assignments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "internet_static_ip_staff_all"
ON public.internet_static_ip_assignments FOR ALL
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'billing_admin')
  OR public.has_role(auth.uid(),'sales')
);
