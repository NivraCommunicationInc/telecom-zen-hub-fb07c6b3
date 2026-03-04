
-- Drop the KYC ticket trigger (correct name) and function with CASCADE
DROP TRIGGER IF EXISTS trigger_create_id_verification_ticket ON public.orders;
DROP FUNCTION IF EXISTS public.create_id_verification_ticket_for_new_client() CASCADE;

-- Add order_id and order_number to identity_verification_sessions (idempotent)
ALTER TABLE public.identity_verification_sessions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Backfill order_id/order_number from existing orders
UPDATE public.identity_verification_sessions s
SET order_id = o.id,
    order_number = o.order_number
FROM public.orders o
WHERE o.identity_verification_session_id = s.id
  AND s.order_id IS NULL;

-- Trigger: auto-populate session.order_id/order_number when order is created
CREATE OR REPLACE FUNCTION public.link_order_to_kyc_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.identity_verification_session_id IS NOT NULL THEN
    UPDATE public.identity_verification_sessions
    SET order_id = NEW.id,
        order_number = NEW.order_number,
        updated_at = NOW()
    WHERE id = NEW.identity_verification_session_id
      AND (order_id IS NULL OR order_id != NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_order_to_kyc_session ON public.orders;
CREATE TRIGGER trg_link_order_to_kyc_session
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.link_order_to_kyc_session();

-- Add required_docs + additional_docs columns for resubmission
ALTER TABLE public.identity_verification_sessions
  ADD COLUMN IF NOT EXISTS required_docs JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS additional_docs JSONB DEFAULT NULL;
