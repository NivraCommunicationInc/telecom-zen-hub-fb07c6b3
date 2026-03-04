
-- Add retention_status to identity_verification_sessions
ALTER TABLE public.identity_verification_sessions 
  ADD COLUMN IF NOT EXISTS retention_status text NOT NULL DEFAULT 'active';

-- Add audit columns for document deletion
ALTER TABLE public.identity_verification_sessions 
  ADD COLUMN IF NOT EXISTS documents_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS documents_deleted_by uuid;

COMMENT ON COLUMN public.identity_verification_sessions.retention_status IS 'active = docs accessible, locked = docs restricted (post-decision), deleted = docs purged from storage';
