-- Daily backup log table for deduplication and audit
CREATE TABLE IF NOT EXISTS public.daily_backup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz,
  completed_at timestamptz,
  email_id text,
  row_counts jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate successful backups per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_backup_log_date_success
  ON public.daily_backup_log (backup_date) WHERE status = 'success';

-- RLS: only service role can access this table
ALTER TABLE public.daily_backup_log ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role can read/write (edge function uses service key)