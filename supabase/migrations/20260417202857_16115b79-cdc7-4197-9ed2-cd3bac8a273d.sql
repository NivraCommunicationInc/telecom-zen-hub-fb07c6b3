-- Drop the ambiguous bytea overload; keep only the text version (plain text passthrough)
DROP FUNCTION IF EXISTS public.decrypt_wifi_password(bytea);