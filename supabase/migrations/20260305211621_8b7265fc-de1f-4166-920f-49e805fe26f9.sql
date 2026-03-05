ALTER TABLE public.orders ADD COLUMN identity_snapshot JSONB;
NOTIFY pgrst, 'reload schema';