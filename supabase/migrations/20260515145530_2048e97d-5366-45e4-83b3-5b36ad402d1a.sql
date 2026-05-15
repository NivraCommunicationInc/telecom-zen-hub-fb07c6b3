CREATE TABLE IF NOT EXISTS public.installation_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  appointment_date TIMESTAMPTZ,
  appointment_window TEXT CHECK (appointment_window IN ('morning','afternoon','evening','flexible')),
  technician_id UUID,
  installation_fee NUMERIC(10,2) DEFAULT 0,
  fee_type TEXT DEFAULT 'standard' CHECK (fee_type IN ('standard','free','custom','waived')),
  fee_notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled','rescheduled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_install_appt_order ON public.installation_appointments(order_id);
CREATE INDEX IF NOT EXISTS idx_install_appt_tech ON public.installation_appointments(technician_id);
CREATE INDEX IF NOT EXISTS idx_install_appt_date ON public.installation_appointments(appointment_date);

ALTER TABLE public.installation_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view appointments"
  ON public.installation_appointments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'field_sales'::app_role)
    OR public.has_role(auth.uid(), 'technician'::app_role)
  );

CREATE POLICY "Staff can create appointments"
  ON public.installation_appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'field_sales'::app_role)
  );

CREATE POLICY "Admins and assigned technician can update"
  ON public.installation_appointments FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'technician'::app_role) AND technician_id = auth.uid())
  );

CREATE TRIGGER trg_install_appt_updated
  BEFORE UPDATE ON public.installation_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();