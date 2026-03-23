
CREATE OR REPLACE FUNCTION generate_quote_public_token()
RETURNS TRIGGER AS $$
BEGIN
  NEW.public_token := encode(extensions.gen_random_bytes(32), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
