ALTER TABLE public.loyalty_redemptions DROP CONSTRAINT IF EXISTS loyalty_redemptions_status_check;
ALTER TABLE public.loyalty_redemptions ADD CONSTRAINT loyalty_redemptions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'applied'::text, 'rejected'::text, 'cancelled'::text]));