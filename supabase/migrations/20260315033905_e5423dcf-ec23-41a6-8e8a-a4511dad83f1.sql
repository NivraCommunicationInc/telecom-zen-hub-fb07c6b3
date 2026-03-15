
-- Fix security definer view issue
ALTER VIEW public.services_public SET (security_invoker = on);
