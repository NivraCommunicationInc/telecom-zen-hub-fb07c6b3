-- Fix function search path
CREATE OR REPLACE FUNCTION public.generate_campaign_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_number IS NULL THEN
    NEW.campaign_number := 'CAMP-' || to_char(now(), 'YYYYMMDD') || '-' || 
      LPAD(COALESCE(
        (SELECT COUNT(*) + 1 FROM public.email_campaigns 
         WHERE created_at::date = CURRENT_DATE)::text, '1'
      ), 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;