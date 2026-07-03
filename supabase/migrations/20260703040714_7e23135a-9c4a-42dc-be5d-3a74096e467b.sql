GRANT SELECT ON public.appointment_slot_rules TO anon, authenticated;
GRANT ALL ON public.appointment_slot_rules TO service_role;

DROP POLICY IF EXISTS "Anyone can view appointment slot rules" ON public.appointment_slot_rules;
CREATE POLICY "Anyone can view appointment slot rules"
  ON public.appointment_slot_rules FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.appointment_blocked_dates TO anon, authenticated;
GRANT ALL ON public.appointment_blocked_dates TO service_role;

DROP POLICY IF EXISTS "Anyone can view appointment blocked dates" ON public.appointment_blocked_dates;
CREATE POLICY "Anyone can view appointment blocked dates"
  ON public.appointment_blocked_dates FOR SELECT
  TO anon, authenticated
  USING (true);