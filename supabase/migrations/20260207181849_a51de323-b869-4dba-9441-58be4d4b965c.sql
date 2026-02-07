-- Fix search_path for remaining functions
ALTER FUNCTION public.enforce_contract_status_transition() SET search_path = public;
ALTER FUNCTION public.validate_contract_status_transition(text, text) SET search_path = public;
ALTER FUNCTION public.validate_signature_token(text) SET search_path = public;
ALTER FUNCTION public.client_sign_contract_with_token(text, text, text) SET search_path = public;
ALTER FUNCTION public.regenerate_contract_pdf(uuid, boolean) SET search_path = public;