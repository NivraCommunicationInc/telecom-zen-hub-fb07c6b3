-- Recreate pg_net extension in non-public schema (pg_net doesn't support SET SCHEMA)
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  current_schema text;
BEGIN
  SELECT n.nspname INTO current_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_net';

  IF current_schema = 'public' THEN
    DROP EXTENSION pg_net;
    CREATE EXTENSION pg_net SCHEMA extensions;
  END IF;
END $$;
