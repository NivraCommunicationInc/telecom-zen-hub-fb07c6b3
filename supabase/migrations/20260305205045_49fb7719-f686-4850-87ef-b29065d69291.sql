ALTER TABLE public.orders ADD COLUMN client_dob DATE;
NOTIFY pgrst, 'reload schema';