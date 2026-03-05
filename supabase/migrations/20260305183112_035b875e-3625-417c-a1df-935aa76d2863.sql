
-- Fix: Set security_invoker on the view to use querying user's RLS
ALTER VIEW public.order_next_actions SET (security_invoker = on);
