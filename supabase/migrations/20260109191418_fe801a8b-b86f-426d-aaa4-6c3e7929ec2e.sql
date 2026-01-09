-- Add soft delete column to payment_methods
ALTER TABLE public.payment_methods 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient filtering on non-deleted cards
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at 
ON public.payment_methods (user_id, deleted_at) 
WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN public.payment_methods.deleted_at IS 'Soft delete timestamp. NULL means active card.';