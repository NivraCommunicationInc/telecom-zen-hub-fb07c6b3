-- Fix: add columns to admin_audit_log that reactivationEngine.ts and other
-- functions try to insert but don't exist in the live table schema.
-- Code uses entity_type/entity_id/performed_by but table only had
-- target_type/target_id/admin_user_id.

ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS performed_by TEXT;
