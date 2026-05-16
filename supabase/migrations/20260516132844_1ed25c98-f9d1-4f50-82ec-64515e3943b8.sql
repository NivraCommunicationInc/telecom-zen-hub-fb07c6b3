DO $mig$
DECLARE
  r record;
  sig text;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
  LOOP
    sig := format('%I.%I(%s)', r.schema_name, r.function_name, r.args);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip grants on %: %', sig, SQLERRM;
    END;
  END LOOP;
END
$mig$;