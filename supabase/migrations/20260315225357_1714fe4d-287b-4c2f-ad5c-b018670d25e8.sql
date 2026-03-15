
-- Day 3: Create canonical installation_jobs table
CREATE TABLE public.installation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE DEFAULT ('INS-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  
  -- Linkage
  order_id uuid REFERENCES public.orders(id),
  account_id uuid REFERENCES public.accounts(id),
  address_id uuid REFERENCES public.service_addresses(id),
  appointment_id uuid REFERENCES public.appointments(id),
  
  -- Technician
  technician_id uuid REFERENCES public.technicians(id),
  technician_assigned_at timestamptz,
  
  -- Job details
  job_type text NOT NULL DEFAULT 'installation',
  installation_level text DEFAULT 'level_1',
  service_type text,
  
  -- Status workflow
  status text NOT NULL DEFAULT 'pending',
  
  -- Scheduling
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  
  -- Address snapshot
  service_address text,
  service_city text,
  service_postal_code text,
  
  -- Client info snapshot
  client_name text,
  client_phone text,
  client_email text,
  
  -- Execution
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  
  -- Equipment
  equipment_installed jsonb DEFAULT '[]'::jsonb,
  
  -- Notes
  technician_notes text,
  internal_notes text,
  client_instructions text,
  
  -- Completion
  completion_photos jsonb DEFAULT '[]'::jsonb,
  client_signature_url text,
  quality_score integer,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Indexes
CREATE INDEX idx_installation_jobs_order_id ON public.installation_jobs(order_id);
CREATE INDEX idx_installation_jobs_account_id ON public.installation_jobs(account_id);
CREATE INDEX idx_installation_jobs_technician_id ON public.installation_jobs(technician_id);
CREATE INDEX idx_installation_jobs_status ON public.installation_jobs(status);
CREATE INDEX idx_installation_jobs_scheduled_date ON public.installation_jobs(scheduled_date);

-- RLS
ALTER TABLE public.installation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_jobs"
  ON public.installation_jobs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/staff can manage installation_jobs"
  ON public.installation_jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'employee', 'technician')
    )
  );

-- Installation job audit log
CREATE TABLE public.installation_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.installation_jobs(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status text,
  new_status text,
  actor_name text,
  actor_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_installation_job_logs_job_id ON public.installation_job_logs(job_id);

ALTER TABLE public.installation_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_job_logs"
  ON public.installation_job_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/staff can insert installation_job_logs"
  ON public.installation_job_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'employee', 'technician')
    )
  );
