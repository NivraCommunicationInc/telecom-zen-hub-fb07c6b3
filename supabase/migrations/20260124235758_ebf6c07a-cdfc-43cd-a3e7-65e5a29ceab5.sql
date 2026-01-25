-- Fix security definer view warning - make it security invoker
DROP VIEW IF EXISTS public.tickets CASCADE;

CREATE VIEW public.tickets 
WITH (security_invoker = true) AS 
SELECT * FROM public.support_tickets;

-- Re-grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.tickets TO anon;