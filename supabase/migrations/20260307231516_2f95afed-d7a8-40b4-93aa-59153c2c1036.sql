-- Fix: Guard both channel selection trigger functions to safely cast channel_assigned_by (TEXT) to confirmed_by (UUID)

CREATE OR REPLACE FUNCTION public.sync_channel_selections_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_tv boolean;
  v_status text;
  v_confirmed_by uuid;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  IF NEW.selected_channels IS NULL OR jsonb_typeof(NEW.selected_channels) <> 'array' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_confirmed_by := NEW.channel_assigned_by::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_confirmed_by := NULL;
  END;

  v_status := CASE
    WHEN NEW.status = 'cancelled' THEN 'cancelled'
    WHEN NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN 'confirmed'
    WHEN COALESCE(NEW.channel_selection_locked, false) THEN 'confirmed'
    ELSE 'pending'
  END;

  INSERT INTO public.channel_selections (
    user_id, order_id, channels, total_price, status, confirmed_at, confirmed_by, updated_at
  ) VALUES (
    NEW.user_id, NEW.id, NEW.selected_channels,
    public.compute_channels_total(NEW.selected_channels),
    v_status,
    CASE WHEN v_status = 'confirmed' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'confirmed' THEN v_confirmed_by ELSE NULL END,
    now()
  )
  ON CONFLICT (order_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    channels = EXCLUDED.channels,
    total_price = EXCLUDED.total_price,
    status = CASE
      WHEN NEW.status = 'cancelled' THEN 'cancelled'
      WHEN channel_selections.status = 'cancelled' AND NEW.status <> 'cancelled' THEN 'pending'
      WHEN channel_selections.status = 'confirmed' AND EXCLUDED.status = 'pending' THEN 'confirmed'
      ELSE EXCLUDED.status
    END,
    confirmed_at = CASE
      WHEN NEW.status = 'cancelled' THEN channel_selections.confirmed_at
      WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(channel_selections.confirmed_at, now())
      ELSE channel_selections.confirmed_at
    END,
    confirmed_by = CASE
      WHEN NEW.status = 'cancelled' THEN channel_selections.confirmed_by
      WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(EXCLUDED.confirmed_by, channel_selections.confirmed_by)
      ELSE channel_selections.confirmed_by
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_channel_selection_activation_from_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_tv boolean;
  v_confirmed_by uuid;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_confirmed_by := NEW.channel_assigned_by::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_confirmed_by := NULL;
  END;

  IF NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN
    UPDATE public.channel_selections
    SET
      status = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, now()),
      confirmed_by = COALESCE(confirmed_by, v_confirmed_by),
      updated_at = now()
    WHERE order_id = NEW.id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.channel_selections
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status <> 'cancelled';
  END IF;

  RETURN NEW;
END;
$$;