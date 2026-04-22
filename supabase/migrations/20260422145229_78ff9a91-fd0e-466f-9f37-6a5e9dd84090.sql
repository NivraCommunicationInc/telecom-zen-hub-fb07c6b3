-- Enable realtime on canonical client-facing tables so status changes propagate
-- to all client portal pages immediately. orders is already in the publication.
DO $$
BEGIN
  -- contracts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contracts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts';
  END IF;

  -- billing_invoices
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'billing_invoices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_invoices';
  END IF;

  -- billing_payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'billing_payments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_payments';
  END IF;

  -- billing_customers (link discovery)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'billing_customers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_customers';
  END IF;

  -- billing_subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'billing_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_subscriptions';
  END IF;

  -- client_auto_documents
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'client_auto_documents' AND relnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_auto_documents'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_auto_documents';
    END IF;
  END IF;

  -- accounts (status / cycles)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts';
  END IF;
END $$;

-- Ensure full row payload is broadcast so filters like user_id=eq.X work reliably
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.contracts REPLICA IDENTITY FULL;
ALTER TABLE public.billing_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.billing_payments REPLICA IDENTITY FULL;
ALTER TABLE public.billing_customers REPLICA IDENTITY FULL;
ALTER TABLE public.billing_subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.accounts REPLICA IDENTITY FULL;