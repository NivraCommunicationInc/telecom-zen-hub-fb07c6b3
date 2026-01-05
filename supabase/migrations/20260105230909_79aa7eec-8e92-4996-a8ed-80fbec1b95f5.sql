
-- Fix search_path for helper functions to resolve security warnings
CREATE OR REPLACE FUNCTION public.normalize_text(val text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(TRIM(COALESCE(val, '')), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.split_full_name(full_name_val text)
RETURNS TABLE(first_name text, last_name text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
  parts text[];
BEGIN
  normalized := public.normalize_text(full_name_val);
  IF normalized IS NULL THEN
    first_name := NULL;
    last_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  parts := string_to_array(normalized, ' ');
  IF array_length(parts, 1) = 1 THEN
    first_name := parts[1];
    last_name := NULL;
  ELSE
    first_name := parts[1];
    last_name := array_to_string(parts[2:], ' ');
  END IF;
  RETURN NEXT;
END;
$$;
