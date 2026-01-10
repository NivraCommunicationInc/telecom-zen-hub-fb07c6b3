-- Fix search_path security warnings for the two new functions
-- Recreate validate_dob_minimum_age with SET search_path
CREATE OR REPLACE FUNCTION public.validate_dob_minimum_age()
RETURNS TRIGGER AS $$
DECLARE
  min_age_date DATE;
BEGIN
  -- Only validate if date_of_birth is provided (not NULL)
  IF NEW.date_of_birth IS NOT NULL THEN
    -- Calculate the date that represents exactly 13 years ago
    min_age_date := CURRENT_DATE - INTERVAL '13 years';
    
    -- Validate: DOB must be on or before min_age_date (person must be at least 13)
    IF NEW.date_of_birth > min_age_date THEN
      RAISE EXCEPTION 'Le client doit avoir au moins 13 ans / Client must be at least 13 years old';
    END IF;
    
    -- Also validate DOB is not in the future
    IF NEW.date_of_birth > CURRENT_DATE THEN
      RAISE EXCEPTION 'La date de naissance ne peut pas être dans le futur / Date of birth cannot be in the future';
    END IF;
    
    -- Sanity check: max age 120 years
    IF NEW.date_of_birth < CURRENT_DATE - INTERVAL '120 years' THEN
      RAISE EXCEPTION 'Date de naissance invalide / Invalid date of birth';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Recreate create_service_instances_from_order with SET search_path
CREATE OR REPLACE FUNCTION public.create_service_instances_from_order()
RETURNS TRIGGER AS $$
DECLARE
  service_name TEXT;
  service_names TEXT[];
  current_service TEXT;
  existing_count INTEGER;
BEGIN
  -- Only trigger on status changes to activation statuses
  IF NEW.status NOT IN ('installation_completed', 'completed', 'delivered', 'activated') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if status didn't change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Parse service_type into individual services (comma-separated)
  IF NEW.service_type IS NOT NULL AND NEW.service_type != '' THEN
    service_names := string_to_array(NEW.service_type, ',');
    
    FOREACH current_service IN ARRAY service_names LOOP
      -- Trim whitespace
      current_service := TRIM(current_service);
      
      -- Skip empty strings
      IF current_service = '' THEN
        CONTINUE;
      END IF;
      
      -- Check if this specific service already exists for this order
      SELECT COUNT(*) INTO existing_count
      FROM public.service_instances
      WHERE order_id = NEW.id AND TRIM(service_type) = current_service;
      
      -- Only insert if not already exists
      IF existing_count = 0 THEN
        INSERT INTO public.service_instances (
          user_id,
          account_id,
          order_id,
          service_type,
          plan_name,
          status,
          monthly_price,
          start_date,
          equipment_details,
          created_at
        ) VALUES (
          NEW.user_id,
          NEW.account_id,
          NEW.id,
          current_service,
          current_service,
          'active',
          NULL,
          CURRENT_DATE,
          COALESCE(NEW.equipment_details, '{}'::jsonb),
          NOW()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;