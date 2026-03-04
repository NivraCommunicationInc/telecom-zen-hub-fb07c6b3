-- Fix trigger_order_confirmation_email: orders table has no client_name column
-- Use profiles.full_name lookup only, remove all NEW.client_name references

CREATE OR REPLACE FUNCTION public.trigger_order_confirmation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_order_number TEXT;
  v_event_key TEXT;
  v_existing_id UUID;
BEGIN
  -- Only trigger on new orders with status 'pending' or 'confirmed'
  IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed', 'processing') THEN
    
    v_order_number := NEW.order_number;
    v_event_key := 'order_confirmation_' || NEW.id::text;
    
    -- Check if already queued (idempotent)
    SELECT id INTO v_existing_id
    FROM email_queue
    WHERE event_key = v_event_key
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get client info from profiles (never reference NEW.client_name which doesn't exist)
    SELECT 
      COALESCE(p.email, NEW.client_email) as email,
      COALESCE(p.full_name, 'Client') as name
    INTO v_client_email, v_client_name
    FROM profiles p
    WHERE p.id = NEW.user_id;
    
    -- Fallback to order fields if profile not found
    IF v_client_email IS NULL THEN
      v_client_email := NEW.client_email;
      v_client_name := 'Client';
    END IF;
    
    -- Only queue if we have an email
    IF v_client_email IS NOT NULL AND v_client_email != '' THEN
      INSERT INTO email_queue (
        event_key,
        to_email,
        template_key,
        template_vars,
        status,
        attempts,
        max_attempts
      ) VALUES (
        v_event_key,
        v_client_email,
        'order_submitted',
        jsonb_build_object(
          'client_name', v_client_name,
          'client_email', v_client_email,
          'order_id', NEW.id,
          'order_number', v_order_number,
          'service_type', COALESCE(NEW.service_type, 'Service Nivra'),
          'total_amount', COALESCE(NEW.total_amount, 0)
        ),
        'queued',
        0,
        3
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;