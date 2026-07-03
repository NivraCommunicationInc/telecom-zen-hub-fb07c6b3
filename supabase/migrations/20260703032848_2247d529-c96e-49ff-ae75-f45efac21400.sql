
CREATE TABLE public.appointment_slot_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  override_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed',
  capacity_override INTEGER,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT appt_slot_override_status_check CHECK (status IN ('closed','reduced')),
  CONSTRAINT appt_slot_override_capacity_check CHECK (capacity_override IS NULL OR capacity_override >= 0),
  CONSTRAINT appt_slot_override_unique UNIQUE (override_date, time_slot)
);

GRANT SELECT ON public.appointment_slot_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.appointment_slot_overrides TO authenticated;
GRANT ALL ON public.appointment_slot_overrides TO service_role;

ALTER TABLE public.appointment_slot_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view slot overrides"
  ON public.appointment_slot_overrides FOR SELECT
  USING (true);

CREATE POLICY "Admins/supervisors manage slot overrides"
  ON public.appointment_slot_overrides FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE INDEX idx_appt_slot_overrides_date ON public.appointment_slot_overrides(override_date);

CREATE TRIGGER trg_appt_slot_overrides_updated_at
  BEFORE UPDATE ON public.appointment_slot_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
