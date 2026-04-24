-- Add tables to realtime publication (idempotent)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'commission_rules',
    'sales_targets',
    'sales_commissions',
    'agent_discount_assignments',
    'agent_discounts',
    'staff_schedules'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    -- Ensure REPLICA IDENTITY FULL so UPDATE/DELETE payloads include old row
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;