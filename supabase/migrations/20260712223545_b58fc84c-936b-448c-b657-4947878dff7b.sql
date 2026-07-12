
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='account_promotions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.account_promotions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='promotions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions';
  END IF;
END$$;
ALTER TABLE public.account_promotions REPLICA IDENTITY FULL;
ALTER TABLE public.promotions REPLICA IDENTITY FULL;
