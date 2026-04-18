-- Add Marketing Hub tables to the supabase_realtime publication so that
-- INSERT / UPDATE / DELETE events are streamed to the admin Marketing Conversations page.
-- Wrapped in DO blocks because adding a table that's already in the publication errors out.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'marketing_conversations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_conversations';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'telephony_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.telephony_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'marketing_ai_replies'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_ai_replies';
  END IF;
END $$;

-- REPLICA IDENTITY FULL ensures the OLD row is included on UPDATE/DELETE
-- so client filters like `id=eq.X` work reliably.
ALTER TABLE public.marketing_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.telephony_logs REPLICA IDENTITY FULL;
ALTER TABLE public.marketing_ai_replies REPLICA IDENTITY FULL;