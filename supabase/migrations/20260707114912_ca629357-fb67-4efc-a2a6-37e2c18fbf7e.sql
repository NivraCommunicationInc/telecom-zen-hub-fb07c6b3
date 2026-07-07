-- Phase 3.C.4 — Nettoyage final legacy PayPal + RPC de renouvellement

-- 1. Suppression des RPC de renouvellement legacy (wrappers dépréciés en 3.C.1)
DROP FUNCTION IF EXISTS public.fn_run_subscription_renewals(integer);
DROP FUNCTION IF EXISTS public.fn_generate_subscription_renewal(uuid);
DROP FUNCTION IF EXISTS public.generate_billing_renewals();

-- 2. Désactivation des cron jobs PayPal résiduels
DO $$
BEGIN
  PERFORM cron.unschedule(101); -- billing-paypal-retry-failed
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule(104); -- paypal-reconcile
EXCEPTION WHEN OTHERS THEN NULL;
END $$;