
ALTER TABLE public.field_payment_intents
  ADD COLUMN IF NOT EXISTS public_token TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_payment_intents_public_token
  ON public.field_payment_intents(public_token)
  WHERE public_token IS NOT NULL;
