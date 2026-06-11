-- ============================================================
-- OSS Provisioning Layer — Schema Migration
-- Nivra Telecom — 2026-06-11
--
-- Tables:
--   provisioning_log    — audit trail of every provisioning action
--   network_elements    — physical/logical network devices (OLT, RADIUS, ONT, router)
--   network_sites       — geographic sites (POP, head-end, client location)
--   inventory_items     — hardware assets (ONT, router, cable, SIM, etc.)
--   inventory_movements — stock movements (reception, installation, return, loss)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- provisioning_log
-- Records every activation/deactivation/modify/terminate action.
-- Safe to insert from functions even if subscription_id is unknown.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provisioning_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   uuid        REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  customer_id       uuid        REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  action            text        NOT NULL CHECK (action IN (
                                  'activate', 'deactivate', 'terminate',
                                  'modify', 'reset', 'suspend', 'reactivate'
                                )),
  adapter           text        NOT NULL DEFAULT 'manual' CHECK (adapter IN (
                                  'manual', 'radius', 'olt', 'mikrotik', 'ubiquiti', 'tr069'
                                )),
  trigger           text        NOT NULL DEFAULT 'api',
  status            text        NOT NULL DEFAULT 'queued_manual' CHECK (status IN (
                                  'success', 'queued_manual', 'failed', 'skipped'
                                )),
  details           jsonb,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_log_subscription_id
  ON public.provisioning_log (subscription_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_customer_id
  ON public.provisioning_log (customer_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_action
  ON public.provisioning_log (action);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_created_at
  ON public.provisioning_log (created_at DESC);

-- RLS
ALTER TABLE public.provisioning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access_provisioning_log"
  ON public.provisioning_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- network_sites
-- Physical or logical locations: POP, head-end, client premise
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.network_sites (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  site_type         text        NOT NULL DEFAULT 'pop' CHECK (site_type IN (
                                  'pop',       -- Point of Presence
                                  'headend',   -- Central office / head-end
                                  'client',    -- Client premise
                                  'cabinet',   -- Street cabinet
                                  'tower'      -- Tower / antenna site
                                )),
  address           text,
  city              text,
  province          text        DEFAULT 'QC',
  country           text        DEFAULT 'CA',
  latitude          numeric(10, 7),
  longitude         numeric(10, 7),
  notes             text,
  status            text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access_network_sites"
  ON public.network_sites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- network_elements
-- Physical and logical network devices managed by Nivra.
-- Each element belongs to a site and has an adapter type.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.network_elements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid        REFERENCES public.network_sites(id) ON DELETE SET NULL,
  name              text        NOT NULL,
  element_type      text        NOT NULL CHECK (element_type IN (
                                  'olt',           -- GPON/XGSPON Optical Line Terminal
                                  'ont',           -- Optical Network Terminal (client side)
                                  'radius_server', -- RADIUS authentication server
                                  'router',        -- Core / edge router
                                  'switch',        -- L2/L3 switch
                                  'acs',           -- TR-069 Auto Configuration Server
                                  'mikrotik',      -- MikroTik router/switch
                                  'ubiquiti',      -- UniFi access point or gateway
                                  'antenna',       -- Wireless backhaul antenna
                                  'modem',         -- DSL or cable modem
                                  'server'         -- Generic server
                                )),
  adapter           text        NOT NULL DEFAULT 'manual' CHECK (adapter IN (
                                  'manual', 'radius', 'olt', 'mikrotik', 'ubiquiti', 'tr069'
                                )),
  -- Connectivity
  ip_address        inet,
  mac_address       macaddr,
  mgmt_url          text,       -- Management URL / API endpoint
  -- Identification
  vendor            text,       -- e.g. "ZTE", "Huawei", "MikroTik", "Ubiquiti"
  model             text,       -- e.g. "C320", "RB750Gr3"
  serial_number     text,
  firmware_version  text,
  -- Capacity (for OLT/RADIUS/etc.)
  capacity_max      integer,    -- Max subscribers / ports
  capacity_used     integer     DEFAULT 0,
  -- Client link
  customer_id       uuid        REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  subscription_id   uuid        REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  -- GPON specific
  olt_id            uuid        REFERENCES public.network_elements(id) ON DELETE SET NULL,
  gpon_port         integer,
  ont_serial        text,
  vlan_id           integer,
  -- PPPoE / RADIUS
  pppoe_username    text,
  radius_username   text,
  -- Status
  status            text        NOT NULL DEFAULT 'active' CHECK (status IN (
                                  'active', 'inactive', 'provisioning', 'decommissioned', 'maintenance'
                                )),
  notes             text,
  installed_at      date,
  decommissioned_at date,
  last_seen_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_elements_customer_id
  ON public.network_elements (customer_id);
CREATE INDEX IF NOT EXISTS idx_network_elements_subscription_id
  ON public.network_elements (subscription_id);
CREATE INDEX IF NOT EXISTS idx_network_elements_element_type
  ON public.network_elements (element_type);
CREATE INDEX IF NOT EXISTS idx_network_elements_ont_serial
  ON public.network_elements (ont_serial);

ALTER TABLE public.network_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access_network_elements"
  ON public.network_elements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- inventory_items
-- Physical assets: ONT, router, SFP module, cable spool, SIM card
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid        REFERENCES public.network_sites(id) ON DELETE SET NULL,
  -- Classification
  category          text        NOT NULL CHECK (category IN (
                                  'ont',           -- Optical Network Terminal
                                  'router',        -- Customer premises router
                                  'switch',        -- Network switch
                                  'sfp',           -- SFP / SFP+ module
                                  'cable',         -- Fiber or copper cable spool
                                  'sim',           -- SIM card / eSIM
                                  'antenna',       -- Wireless antenna
                                  'power',         -- UPS / power supply
                                  'tool',          -- Installation tool
                                  'other'
                                )),
  name              text        NOT NULL,
  vendor            text,
  model             text,
  part_number       text,
  serial_number     text        UNIQUE,
  -- Stock
  quantity          integer     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  quantity_reserved integer     NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  reorder_point     integer     DEFAULT 5,
  -- Pricing
  unit_cost         numeric(10, 2),
  -- Assignment
  status            text        NOT NULL DEFAULT 'in_stock' CHECK (status IN (
                                  'in_stock',      -- Available
                                  'reserved',      -- Assigned to a work order
                                  'installed',     -- Deployed at client site
                                  'returned',      -- Returned from client
                                  'defective',     -- Defective / RMA
                                  'disposed'       -- Discarded
                                )),
  network_element_id uuid       REFERENCES public.network_elements(id) ON DELETE SET NULL,
  customer_id       uuid        REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  notes             text,
  purchased_at      date,
  warranty_until    date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category
  ON public.inventory_items (category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_customer_id
  ON public.inventory_items (customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status
  ON public.inventory_items (status);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access_inventory_items"
  ON public.inventory_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- inventory_movements
-- Stock ledger: every in/out movement of inventory items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid        NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type     text        NOT NULL CHECK (movement_type IN (
                                  'reception',     -- New stock received from supplier
                                  'installation',  -- Deployed to client
                                  'return',        -- Returned from client
                                  'transfer',      -- Moved between sites
                                  'adjustment',    -- Manual correction
                                  'loss',          -- Theft / damage / write-off
                                  'rma'            -- Sent to vendor for repair
                                )),
  quantity_delta    integer     NOT NULL,           -- Positive = in, Negative = out
  quantity_after    integer     NOT NULL,
  -- Context
  customer_id       uuid        REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  site_from_id      uuid        REFERENCES public.network_sites(id) ON DELETE SET NULL,
  site_to_id        uuid        REFERENCES public.network_sites(id) ON DELETE SET NULL,
  reference         text,                           -- Work order #, PO#, etc.
  notes             text,
  performed_by      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id
  ON public.inventory_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_customer_id
  ON public.inventory_movements (customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
  ON public.inventory_movements (created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access_inventory_movements"
  ON public.inventory_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- Helper view: low stock alert
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_inventory_low_stock AS
SELECT
  id,
  category,
  name,
  vendor,
  model,
  quantity,
  reorder_point,
  (quantity - reorder_point) AS stock_gap
FROM public.inventory_items
WHERE quantity <= reorder_point
  AND status = 'in_stock'
ORDER BY stock_gap ASC;

-- ─────────────────────────────────────────────────────────────
-- Helper view: provisioning dashboard (last 30 days)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_provisioning_dashboard AS
SELECT
  action,
  adapter,
  status,
  COUNT(*) AS count,
  DATE(created_at) AS day
FROM public.provisioning_log
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY action, adapter, status, DATE(created_at)
ORDER BY day DESC, action;
