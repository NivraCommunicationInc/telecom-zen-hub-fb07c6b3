
-- Installation types enum
CREATE TYPE public.installation_zone AS ENUM ('zone_a', 'zone_b', 'zone_c');
CREATE TYPE public.technician_level AS ENUM ('level_1', 'level_2');
CREATE TYPE public.installation_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- Installations table
CREATE TABLE public.installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  client_id UUID NOT NULL,
  installation_type TEXT NOT NULL DEFAULT 'technician', -- 'auto' or 'technician'
  technician_level public.technician_level DEFAULT 'level_1',
  zone public.installation_zone DEFAULT 'zone_a',
  distance_km NUMERIC(8,2),
  -- Cabling questionnaire answers
  has_coaxial TEXT, -- 'yes', 'no', 'unknown'
  cable_status TEXT, -- 'connected', 'cut', 'unknown'
  previous_service TEXT, -- 'yes', 'no', 'unknown'
  -- Scheduling
  appointment_date DATE,
  time_slot TEXT,
  status public.installation_status DEFAULT 'pending',
  -- Address
  service_address TEXT,
  service_city TEXT,
  service_postal_code TEXT,
  -- Notes
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;

-- Clients can view their own installations
CREATE POLICY "Clients can view own installations" ON public.installations
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Clients can insert their own installations
CREATE POLICY "Clients can insert own installations" ON public.installations
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Admin/staff can manage all
CREATE POLICY "Admin can manage all installations" ON public.installations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Technician slots table
CREATE TABLE public.technician_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  time_slot TEXT NOT NULL, -- e.g., '8h - 12h', '12h - 17h', '17h - 20h'
  region TEXT NOT NULL DEFAULT 'montreal', -- 'montreal', 'region'
  technician_level public.technician_level NOT NULL DEFAULT 'level_1',
  capacity INTEGER NOT NULL DEFAULT 3,
  booked INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_date, time_slot, region, technician_level)
);

ALTER TABLE public.technician_slots ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view slots
CREATE POLICY "Authenticated can view slots" ON public.technician_slots
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can manage slots
CREATE POLICY "Admin can manage slots" ON public.technician_slots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to auto-generate slots for the next 14 days
CREATE OR REPLACE FUNCTION public.generate_technician_slots(days_ahead INTEGER DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  slot TEXT;
  lvl public.technician_level;
BEGIN
  FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + days_ahead, '1 day'::interval)::date
  LOOP
    -- Skip Sundays
    IF EXTRACT(DOW FROM d) = 0 THEN CONTINUE; END IF;
    
    FOR slot IN SELECT unnest(ARRAY['8h - 12h', '12h - 17h', '17h - 20h'])
    LOOP
      FOR lvl IN SELECT unnest(ARRAY['level_1', 'level_2']::public.technician_level[])
      LOOP
        INSERT INTO public.technician_slots (slot_date, time_slot, region, technician_level, capacity)
        VALUES (d, slot, 'montreal', lvl, CASE WHEN lvl = 'level_1' THEN 4 ELSE 2 END)
        ON CONFLICT (slot_date, time_slot, region, technician_level) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- Generate initial slots
SELECT public.generate_technician_slots(14);
