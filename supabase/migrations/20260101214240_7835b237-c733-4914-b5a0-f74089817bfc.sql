-- Create internal staff tickets table
CREATE TABLE public.internal_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT,
  created_by_id UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'employee', 'technician')),
  created_by_email TEXT,
  
  -- Destination
  assigned_to_department TEXT NOT NULL CHECK (assigned_to_department IN ('admin', 'employee', 'technician', 'all')),
  assigned_to_id UUID,
  assigned_to_name TEXT,
  
  -- CC departments
  cc_departments JSONB DEFAULT '[]'::jsonb,
  
  -- Ticket content
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending', 'resolved', 'closed')),
  
  -- Metadata
  internal_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_id UUID,
  resolved_by_name TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create internal ticket replies table
CREATE TABLE public.internal_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS internal_ticket_seq START 1;

-- Function to generate internal ticket number
CREATE OR REPLACE FUNCTION public.generate_internal_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'INT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('internal_ticket_seq')::TEXT, 5, '0');
END;
$$;

-- Trigger to auto-set ticket number
CREATE OR REPLACE FUNCTION public.set_internal_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_internal_ticket_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_internal_ticket_number_trigger
BEFORE INSERT OR UPDATE ON public.internal_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_internal_ticket_number();

-- RLS Policies for internal_tickets
-- Admins can do everything
CREATE POLICY "Admins can manage all internal tickets"
ON public.internal_tickets
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Employees can view tickets assigned to employees or created by them
CREATE POLICY "Employees can view relevant internal tickets"
ON public.internal_tickets
FOR SELECT
USING (
  has_role(auth.uid(), 'employee') AND (
    assigned_to_department IN ('employee', 'all') OR
    created_by_id = auth.uid() OR
    cc_departments ? 'employee'
  )
);

-- Employees can create tickets
CREATE POLICY "Employees can create internal tickets"
ON public.internal_tickets
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'employee'));

-- Employees can update their own tickets or assigned to them
CREATE POLICY "Employees can update relevant tickets"
ON public.internal_tickets
FOR UPDATE
USING (
  has_role(auth.uid(), 'employee') AND (
    created_by_id = auth.uid() OR
    (assigned_to_department = 'employee' AND assigned_to_id = auth.uid())
  )
);

-- Technicians can view tickets assigned to technicians or created by them
CREATE POLICY "Technicians can view relevant internal tickets"
ON public.internal_tickets
FOR SELECT
USING (
  has_role(auth.uid(), 'technician') AND (
    assigned_to_department IN ('technician', 'all') OR
    created_by_id = auth.uid() OR
    cc_departments ? 'technician'
  )
);

-- Technicians can create tickets
CREATE POLICY "Technicians can create internal tickets"
ON public.internal_tickets
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'technician'));

-- Technicians can update their own tickets or assigned to them
CREATE POLICY "Technicians can update relevant tickets"
ON public.internal_tickets
FOR UPDATE
USING (
  has_role(auth.uid(), 'technician') AND (
    created_by_id = auth.uid() OR
    (assigned_to_department = 'technician' AND assigned_to_id = auth.uid())
  )
);

-- RLS Policies for internal_ticket_replies
CREATE POLICY "Admins can manage all replies"
ON public.internal_ticket_replies
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view replies on accessible tickets"
ON public.internal_ticket_replies
FOR SELECT
USING (
  ticket_id IN (
    SELECT id FROM public.internal_tickets
    WHERE (
      has_role(auth.uid(), 'admin') OR
      (has_role(auth.uid(), 'employee') AND (assigned_to_department IN ('employee', 'all') OR created_by_id = auth.uid() OR cc_departments ? 'employee')) OR
      (has_role(auth.uid(), 'technician') AND (assigned_to_department IN ('technician', 'all') OR created_by_id = auth.uid() OR cc_departments ? 'technician'))
    )
  )
);

CREATE POLICY "Staff can create replies on accessible tickets"
ON public.internal_ticket_replies
FOR INSERT
WITH CHECK (
  ticket_id IN (
    SELECT id FROM public.internal_tickets
    WHERE (
      has_role(auth.uid(), 'admin') OR
      (has_role(auth.uid(), 'employee') AND (assigned_to_department IN ('employee', 'all') OR created_by_id = auth.uid() OR cc_departments ? 'employee')) OR
      (has_role(auth.uid(), 'technician') AND (assigned_to_department IN ('technician', 'all') OR created_by_id = auth.uid() OR cc_departments ? 'technician'))
    )
  )
);

-- Add indexes for performance
CREATE INDEX idx_internal_tickets_assigned_dept ON public.internal_tickets(assigned_to_department);
CREATE INDEX idx_internal_tickets_created_by ON public.internal_tickets(created_by_id);
CREATE INDEX idx_internal_tickets_status ON public.internal_tickets(status);
CREATE INDEX idx_internal_ticket_replies_ticket ON public.internal_ticket_replies(ticket_id);