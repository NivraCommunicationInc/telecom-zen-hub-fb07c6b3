
-- Add public_token column for secure public access to quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON public.quotes(public_token) WHERE public_token IS NOT NULL;

-- Function to auto-generate public_token on quote creation
CREATE OR REPLACE FUNCTION public.generate_quote_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate public_token
DROP TRIGGER IF EXISTS trg_generate_quote_public_token ON public.quotes;
CREATE TRIGGER trg_generate_quote_public_token
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_quote_public_token();

-- Backfill existing quotes without public_token
UPDATE public.quotes SET public_token = encode(gen_random_bytes(32), 'hex') WHERE public_token IS NULL;

-- RLS policy: allow anonymous read access via public_token (for public quote page)
CREATE POLICY "Public can read quotes by token"
  ON public.quotes
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

-- RLS policy: allow anonymous read of quote_lines for public quotes
CREATE POLICY "Public can read quote_lines via quote"
  ON public.quote_lines
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.public_token IS NOT NULL
  ));

-- RLS policy: allow anonymous read of quote_adjustments for public quotes (approved only)
CREATE POLICY "Public can read approved quote_adjustments via quote"
  ON public.quote_adjustments
  FOR SELECT
  TO anon
  USING (
    approval_status = 'approved' AND
    EXISTS (
      SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.public_token IS NOT NULL
    )
  );
