-- Add target columns to admin_audit_log for better querying
ALTER TABLE public.admin_audit_log 
ADD COLUMN IF NOT EXISTS target_type TEXT,
ADD COLUMN IF NOT EXISTS target_id UUID,
ADD COLUMN IF NOT EXISTS target_email TEXT;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_email ON public.admin_audit_log(target_email);