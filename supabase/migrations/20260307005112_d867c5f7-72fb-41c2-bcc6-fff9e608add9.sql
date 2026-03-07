-- Trigger: prevent duplicate serial numbers across orders
-- Covers serial_number, iccid, imei, mac_address in equipment_details JSONB

CREATE OR REPLACE FUNCTION public.validate_equipment_serial_uniqueness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit JSONB;
  sn TEXT;
  iccid_val TEXT;
  imei_val TEXT;
  mac_val TEXT;
  conflict_order TEXT;
BEGIN
  -- Only validate if equipment_details is a JSON array
  IF NEW.equipment_details IS NULL 
     OR jsonb_typeof(NEW.equipment_details) != 'array' 
     OR jsonb_array_length(NEW.equipment_details) = 0 THEN
    RETURN NEW;
  END IF;

  FOR unit IN SELECT jsonb_array_elements(NEW.equipment_details)
  LOOP
    sn := NULLIF(TRIM(unit->>'serial_number'), '');
    iccid_val := NULLIF(TRIM(unit->>'iccid'), '');
    imei_val := NULLIF(TRIM(unit->>'imei'), '');
    mac_val := NULLIF(TRIM(UPPER(unit->>'mac_address')), '');

    -- Check serial_number uniqueness across other orders
    IF sn IS NOT NULL THEN
      SELECT order_number INTO conflict_order
      FROM orders
      WHERE id != NEW.id
        AND equipment_details IS NOT NULL
        AND jsonb_typeof(equipment_details) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(equipment_details) AS e
          WHERE TRIM(e->>'serial_number') = sn
        )
      LIMIT 1;

      IF conflict_order IS NOT NULL THEN
        RAISE EXCEPTION 'equipment_serial_unique: Numéro de série "%" déjà assigné à la commande %', sn, conflict_order;
      END IF;
    END IF;

    -- Check ICCID uniqueness
    IF iccid_val IS NOT NULL THEN
      SELECT order_number INTO conflict_order
      FROM orders
      WHERE id != NEW.id
        AND equipment_details IS NOT NULL
        AND jsonb_typeof(equipment_details) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(equipment_details) AS e
          WHERE TRIM(e->>'iccid') = iccid_val
        )
      LIMIT 1;

      IF conflict_order IS NOT NULL THEN
        RAISE EXCEPTION 'equipment_serial_unique: ICCID "%" déjà assigné à la commande %', iccid_val, conflict_order;
      END IF;
    END IF;

    -- Check IMEI uniqueness
    IF imei_val IS NOT NULL THEN
      SELECT order_number INTO conflict_order
      FROM orders
      WHERE id != NEW.id
        AND equipment_details IS NOT NULL
        AND jsonb_typeof(equipment_details) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(equipment_details) AS e
          WHERE TRIM(e->>'imei') = imei_val
        )
      LIMIT 1;

      IF conflict_order IS NOT NULL THEN
        RAISE EXCEPTION 'equipment_serial_unique: IMEI "%" déjà assigné à la commande %', imei_val, conflict_order;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_validate_equipment_serial_uniqueness ON orders;
CREATE TRIGGER trg_validate_equipment_serial_uniqueness
  BEFORE INSERT OR UPDATE OF equipment_details ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_equipment_serial_uniqueness();