
-- MIGRATION 1: Enums + Roles only
CREATE TYPE public.order_lifecycle_status AS ENUM (
  'draft','submitted','kyc_required','kyc_in_review','kyc_approved','kyc_rejected',
  'payment_pending','paid','payment_failed','fulfillment_pending',
  'provisioning_pending','provisioning_in_progress','active','partial_active',
  'on_hold','completed','cancelled','failed','provisioning_failed'
);

CREATE TYPE public.order_item_status AS ENUM (
  'pending','kyc_blocked','payment_blocked','fulfillment_pending','shipped','delivered',
  'install_scheduled','install_complete','provisioning_pending','provisioning_in_progress',
  'active','on_hold','cancelled','failed'
);

CREATE TYPE public.order_item_service_type AS ENUM (
  'internet','tv','mobile','streaming','security','addon','equipment','fee'
);

CREATE TYPE public.provisioning_job_status AS ENUM (
  'queued','waiting_dependency','in_progress','completed','failed','cancelled','manual_override'
);

CREATE TYPE public.provisioning_job_type AS ENUM (
  'INTERNET_ACTIVATE','TV_ACTIVATE','MOBILE_ACTIVATE','STREAMING_ACTIVATE',
  'SECURITY_ACTIVATE','PORT_IN','ESIM_PROVISION','CHANNEL_PUSH','EQUIPMENT_ASSIGN','CUSTOM'
);

CREATE TYPE public.shipment_status AS ENUM (
  'pending','preparing','shipped','in_transit','delivered','returned','lost','cancelled'
);

CREATE TYPE public.inventory_stock_type AS ENUM (
  'modem','router','sim_card','esim','tv_box','remote','cable','security_hub','camera','other'
);

CREATE TYPE public.inventory_assignment_status AS ENUM (
  'reserved','assigned','shipped','installed','returned','lost','defective'
);

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kyc_agent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'billing_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'techops';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
