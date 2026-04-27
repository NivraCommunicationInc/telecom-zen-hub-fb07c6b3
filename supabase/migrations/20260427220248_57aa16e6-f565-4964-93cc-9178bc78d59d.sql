-- Add missing tables to supabase_realtime publication.
-- Use DO blocks so the migration is idempotent (won't fail if already added).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'staff_notifications',
      'support_tickets',
      'accounts',
      'billing_subscriptions',
      'kyc_verifications',
      'appointments'
    ])
  LOOP
    -- Skip if table doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      RAISE NOTICE 'Skipping %, table does not exist', t;
      CONTINUE;
    END IF;
    -- Skip if already in publication
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      RAISE NOTICE 'Skipping %, already in supabase_realtime', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    -- Ensure full row data on UPDATE/DELETE for proper change events
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;