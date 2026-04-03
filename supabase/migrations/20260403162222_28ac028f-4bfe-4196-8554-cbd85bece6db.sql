
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'ledger_entries','billing_system_alerts','transaction_events',
      'payments','payment_proofs','sales_commissions',
      'payroll_entries','payroll_commission_links'
    ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;
