-- Force PostgREST schema cache reload (multiple methods)
NOTIFY pgrst, 'reload schema';

-- Also notify on config change
NOTIFY pgrst, 'reload config';