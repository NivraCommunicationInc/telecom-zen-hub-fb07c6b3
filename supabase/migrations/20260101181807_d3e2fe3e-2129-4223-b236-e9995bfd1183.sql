
-- Create work_order_status enum
CREATE TYPE public.work_order_status AS ENUM (
  'assigned',
  'scheduled', 
  'in_progress',
  'completed',
  'cancelled'
);

-- Create work_order_type enum
CREATE TYPE public.work_order_type AS ENUM (
  'installation',
  'service_call',
  'replacement',
  'maintenance'
);

-- Create work_orders table - single source of truth for technician jobs
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_number TEXT UNIQUE,
  type work_order_type NOT NULL DEFAULT 'installation',
  
  -- Links to source records
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Client info (denormalized for technician convenience)
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  
  -- Service location
  service_address TEXT,
  service_city TEXT,
  service_postal_code TEXT,
  service_province TEXT DEFAULT 'QC',
  
  -- Scheduling
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  
  -- Assignment
  assigned_technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID,
  
  -- Status tracking
  status work_order_status NOT NULL DEFAULT 'assigned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Work details
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'low')),
  service_type TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Equipment
  equipment_details JSONB DEFAULT '[]'::jsonb,
  
  -- Checklist
  checklist JSONB DEFAULT '[]'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create sequence for work order numbers
CREATE SEQUENCE IF NOT EXISTS work_order_seq START 1;

-- Function to generate work order number
CREATE OR REPLACE FUNCTION public.generate_work_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'WO-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('work_order_seq')::TEXT, 5, '0');
END;
$$;

-- Trigger to set work order number
CREATE OR REPLACE FUNCTION public.set_work_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.work_order_number IS NULL THEN
    NEW.work_order_number := generate_work_order_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_work_order_number_trigger
  BEFORE INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_order_number();

-- Create work_order_updates table for status history
CREATE TABLE public.work_order_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_role TEXT,
  actor_name TEXT,
  old_status TEXT,
  new_status TEXT,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create work_order_files table for photos/signatures
CREATE TABLE public.work_order_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'photo' CHECK (file_type IN ('photo', 'signature', 'document')),
  file_name TEXT,
  uploaded_by_technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_files ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is the assigned technician
CREATE OR REPLACE FUNCTION public.is_assigned_technician(_work_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.work_orders wo
    JOIN public.technicians t ON wo.assigned_technician_id = t.id
    WHERE wo.id = _work_order_id
      AND t.user_id = auth.uid()
  )
$$;

-- RLS Policies for work_orders
CREATE POLICY "Admins can manage all work orders"
  ON public.work_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage all work orders"
  ON public.work_orders FOR ALL
  USING (has_role(auth.uid(), 'employee'));

CREATE POLICY "Technicians can view their assigned work orders"
  ON public.work_orders FOR SELECT
  USING (
    assigned_technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can update their assigned work orders"
  ON public.work_orders FOR UPDATE
  USING (
    assigned_technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

-- Allow public read for login lookup (technicians without auth user)
CREATE POLICY "Allow technician portal access"
  ON public.work_orders FOR SELECT
  USING (true);

-- RLS Policies for work_order_updates
CREATE POLICY "Admins can manage work order updates"
  ON public.work_order_updates FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage work order updates"
  ON public.work_order_updates FOR ALL
  USING (has_role(auth.uid(), 'employee'));

CREATE POLICY "Technicians can view updates for their work orders"
  ON public.work_order_updates FOR SELECT
  USING (is_assigned_technician(work_order_id));

CREATE POLICY "Technicians can create updates for their work orders"
  ON public.work_order_updates FOR INSERT
  WITH CHECK (is_assigned_technician(work_order_id));

-- RLS Policies for work_order_files
CREATE POLICY "Admins can manage work order files"
  ON public.work_order_files FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage work order files"
  ON public.work_order_files FOR ALL
  USING (has_role(auth.uid(), 'employee'));

CREATE POLICY "Technicians can view files for their work orders"
  ON public.work_order_files FOR SELECT
  USING (is_assigned_technician(work_order_id));

CREATE POLICY "Technicians can upload files for their work orders"
  ON public.work_order_files FOR INSERT
  WITH CHECK (is_assigned_technician(work_order_id));

-- Create index for fast technician lookup
CREATE INDEX idx_work_orders_technician ON public.work_orders(assigned_technician_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_work_orders_scheduled ON public.work_orders(scheduled_start);
CREATE INDEX idx_work_order_updates_work_order ON public.work_order_updates(work_order_id);
CREATE INDEX idx_work_order_files_work_order ON public.work_order_files(work_order_id);

-- Enable realtime for work_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
