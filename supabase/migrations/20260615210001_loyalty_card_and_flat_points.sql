-- FEATURE 4: Loyalty — flat 100 pts per order, NVR-XXXX-XXXX card number

-- 1. Add card_number to loyalty_points
ALTER TABLE public.loyalty_points
  ADD COLUMN IF NOT EXISTS card_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.loyalty_card_seq START 10001;

CREATE OR REPLACE FUNCTION public.fn_generate_loyalty_card_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_seq INT;
  v_part1 TEXT;
  v_part2 TEXT;
BEGIN
  v_seq := nextval('public.loyalty_card_seq');
  -- Split into two 4-char groups: first 4 and last 4 digits of seq padded to 8
  v_part1 := LPAD((v_seq / 10000)::TEXT, 4, '0');
  v_part2 := LPAD((v_seq % 10000)::TEXT, 4, '0');
  RETURN 'NVR-' || v_part1 || '-' || v_part2;
END;
$$;

-- Auto-assign card_number on insert if null
CREATE OR REPLACE FUNCTION public.fn_assign_loyalty_card()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.card_number IS NULL THEN
    NEW.card_number := public.fn_generate_loyalty_card_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_loyalty_card ON public.loyalty_points;
CREATE TRIGGER trg_assign_loyalty_card
BEFORE INSERT ON public.loyalty_points
FOR EACH ROW EXECUTE FUNCTION public.fn_assign_loyalty_card();

-- Backfill card numbers for existing rows
UPDATE public.loyalty_points
SET card_number = public.fn_generate_loyalty_card_number()
WHERE card_number IS NULL;

-- 2. Fix points calculation: flat 100 pts per payment (not amount * 10)
CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_points_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER := 100;
  v_account_id UUID;
  v_client_id UUID;
  v_new_balance INTEGER;
BEGIN
  IF NEW.status IN ('confirmed','completed','captured','succeeded')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed','completed','captured','succeeded')) THEN

    SELECT o.account_id, a.client_id INTO v_account_id, v_client_id
    FROM public.billing_invoices bi
    LEFT JOIN public.orders o ON o.id = bi.order_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE bi.id = NEW.invoice_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (v_account_id, v_client_id, v_points, v_points, v_points)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points       = public.loyalty_points.total_points + EXCLUDED.total_points,
          available_points   = public.loyalty_points.available_points + EXCLUDED.available_points,
          lifetime_points    = public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
          tier = CASE
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'platinum'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 1500 THEN 'gold'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 500  THEN 'silver'
            ELSE 'bronze'
          END,
          tier_updated_at = now(),
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES (
      v_account_id,
      'earned_payment',
      v_points,
      'Points fidélité — paiement confirmé',
      NEW.id,
      'billing_payment',
      v_new_balance,
      now() + INTERVAL '2 years'
    );
  END IF;
  RETURN NEW;
END;
$$;
