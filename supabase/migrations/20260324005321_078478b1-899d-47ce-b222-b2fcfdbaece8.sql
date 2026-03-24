DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'accepted_pending_checkout'
  ) THEN
    ALTER TYPE public.quote_status ADD VALUE 'accepted_pending_checkout' AFTER 'viewed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'checkout_in_progress'
  ) THEN
    ALTER TYPE public.quote_status ADD VALUE 'checkout_in_progress' AFTER 'accepted_pending_checkout';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'checkout_completed'
  ) THEN
    ALTER TYPE public.quote_status ADD VALUE 'checkout_completed' AFTER 'checkout_in_progress';
  END IF;
END
$$;