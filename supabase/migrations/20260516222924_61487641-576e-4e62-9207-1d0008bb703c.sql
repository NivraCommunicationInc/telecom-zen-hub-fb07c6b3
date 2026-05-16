CREATE OR REPLACE FUNCTION public.generate_contract_signature_token(p_contract_id uuid, p_role text DEFAULT 'client'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_token text;
  v_token_hash text;
BEGIN
  IF p_role NOT IN ('client', 'admin') THEN
    RAISE EXCEPTION 'Role invalide: client ou admin requis';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  v_token_hash := encode(extensions.digest(v_token::bytea, 'sha256'), 'hex');

  UPDATE public.contracts
  SET
    signature_token = v_token,
    signature_token_hash = v_token_hash,
    signature_token_expires_at = now() + interval '7 days',
    signature_token_role = p_role,
    signature_token_used_at = NULL,
    updated_at = now()
  WHERE id = p_contract_id;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quote_public_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;