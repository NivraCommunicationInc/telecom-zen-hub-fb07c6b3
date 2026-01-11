-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_order_contest_entry ON public.orders;
DROP TRIGGER IF EXISTS trigger_order_contest_entry_insert ON public.orders;
DROP FUNCTION IF EXISTS public.handle_order_contest_entry_insert();

-- Create INSERT trigger function that adds contest entry when BIENVENUE promo is used
CREATE OR REPLACE FUNCTION public.handle_order_contest_entry_insert()
RETURNS TRIGGER AS $$
DECLARE
  normalized_promo TEXT;
  profile_record RECORD;
  prior_order_count INTEGER;
BEGIN
  -- Normalize promo code: trim, uppercase, remove trailing punctuation
  normalized_promo := UPPER(TRIM(COALESCE(NEW.promo_code, '')));
  normalized_promo := REGEXP_REPLACE(normalized_promo, '[.,;:!?]+$', '');
  
  -- Only proceed if promo code is BIENVENUE
  IF normalized_promo <> 'BIENVENUE' THEN
    RETURN NEW;
  END IF;
  
  -- Check if user_id exists
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is a new customer (no prior completed orders)
  SELECT COUNT(*) INTO prior_order_count
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND status IN ('completed', 'installation_completed');
  
  -- Only new customers qualify
  IF prior_order_count > 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get profile info for snapshots
  SELECT email, full_name, phone INTO profile_record
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;
  
  -- Use order email as fallback
  IF profile_record IS NULL OR profile_record.email IS NULL THEN
    profile_record.email := NEW.customer_email;
    profile_record.full_name := NEW.customer_name;
    profile_record.phone := NEW.customer_phone;
  END IF;
  
  -- Insert contest entry (idempotent: ON CONFLICT DO NOTHING)
  INSERT INTO public.contest_entries (
    contest_slug,
    user_id,
    order_id,
    email_snapshot,
    full_name_snapshot,
    phone_snapshot,
    promo_code_snapshot
  ) VALUES (
    'welcome-500-2026',
    NEW.user_id,
    NEW.id,
    COALESCE(profile_record.email, NEW.customer_email, 'unknown@email.com'),
    COALESCE(profile_record.full_name, NEW.customer_name),
    COALESCE(profile_record.phone, NEW.customer_phone),
    'BIENVENUE'
  )
  ON CONFLICT (contest_slug, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on INSERT
CREATE TRIGGER trigger_order_contest_entry_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_contest_entry_insert();

-- Also handle UPDATE for orders that change promo_code to BIENVENUE later
CREATE OR REPLACE FUNCTION public.handle_order_contest_entry()
RETURNS TRIGGER AS $$
DECLARE
  normalized_promo TEXT;
  profile_record RECORD;
  prior_order_count INTEGER;
BEGIN
  -- Normalize promo code
  normalized_promo := UPPER(TRIM(COALESCE(NEW.promo_code, '')));
  normalized_promo := REGEXP_REPLACE(normalized_promo, '[.,;:!?]+$', '');
  
  -- Only proceed if promo code is BIENVENUE
  IF normalized_promo <> 'BIENVENUE' THEN
    RETURN NEW;
  END IF;
  
  -- Check if user_id exists
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is a new customer
  SELECT COUNT(*) INTO prior_order_count
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND status IN ('completed', 'installation_completed');
  
  IF prior_order_count > 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get profile info
  SELECT email, full_name, phone INTO profile_record
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;
  
  IF profile_record IS NULL OR profile_record.email IS NULL THEN
    profile_record.email := NEW.customer_email;
    profile_record.full_name := NEW.customer_name;
    profile_record.phone := NEW.customer_phone;
  END IF;
  
  -- Insert contest entry (idempotent)
  INSERT INTO public.contest_entries (
    contest_slug,
    user_id,
    order_id,
    email_snapshot,
    full_name_snapshot,
    phone_snapshot,
    promo_code_snapshot
  ) VALUES (
    'welcome-500-2026',
    NEW.user_id,
    NEW.id,
    COALESCE(profile_record.email, NEW.customer_email, 'unknown@email.com'),
    COALESCE(profile_record.full_name, NEW.customer_name),
    COALESCE(profile_record.phone, NEW.customer_phone),
    'BIENVENUE'
  )
  ON CONFLICT (contest_slug, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create UPDATE trigger
CREATE TRIGGER trigger_order_contest_entry
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_contest_entry();