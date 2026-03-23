
-- Phase 1: Add kyc_status column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_required';

-- Guard trigger: block irrecoverable transitions if KYC not approved
CREATE OR REPLACE FUNCTION public.guard_activation_requires_kyc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Block installed, activated, completed if kyc not approved/not_required
    IF NEW.status IN ('installed', 'activated', 'completed')
       AND NEW.kyc_status NOT IN ('approved', 'not_required') THEN
      RAISE EXCEPTION 'Transition vers "%" bloquée — kyc_status est "%". Approbation KYC requise avant toute progression irréversible.', NEW.status, NEW.kyc_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_activation_requires_kyc ON public.orders;
CREATE TRIGGER trg_guard_activation_requires_kyc
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_activation_requires_kyc();
