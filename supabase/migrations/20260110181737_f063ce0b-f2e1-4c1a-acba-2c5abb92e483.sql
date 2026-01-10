-- Add unique constraint to prevent duplicate redemptions for same order
-- A client can only redeem a promotion once per order
ALTER TABLE public.promotion_redemptions 
ADD CONSTRAINT unique_promotion_order 
UNIQUE (promotion_id, order_id);

-- Also add index for better query performance on promotion lookups
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_promotion_id 
ON public.promotion_redemptions (promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_client_id 
ON public.promotion_redemptions (client_id);