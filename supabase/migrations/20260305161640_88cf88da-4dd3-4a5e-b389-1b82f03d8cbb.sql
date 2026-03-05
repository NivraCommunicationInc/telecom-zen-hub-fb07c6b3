
-- Update generate_technician_slots to use new 4-slot format
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
    
    FOR slot IN SELECT unnest(ARRAY['09h - 12h', '12h - 15h', '15h - 18h', '18h - 20h'])
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

-- Clear old-format slots and regenerate
DELETE FROM public.technician_slots WHERE time_slot IN ('8h - 12h', '12h - 17h', '17h - 20h');
SELECT public.generate_technician_slots(14);

-- Add readiness_score column to installations table
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0;

-- Add needs_fallback_ticket column 
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS needs_fallback_ticket BOOLEAN DEFAULT false;

-- Add fallback_ticket_id for tracking auto-install validation
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS fallback_ticket_id UUID;
