
ALTER FUNCTION public.normalize_address(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.compute_address_hash(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.trg_service_address_normalize() SET search_path = public;
ALTER FUNCTION public.trg_enforce_single_default_address() SET search_path = public;
