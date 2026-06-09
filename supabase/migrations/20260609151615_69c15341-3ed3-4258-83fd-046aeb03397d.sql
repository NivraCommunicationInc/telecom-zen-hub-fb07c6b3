UPDATE public.field_payment_intents fpi
SET converted_order_id = fq.converted_order_id,
    updated_at = now()
FROM public.field_quotes fq
WHERE fpi.quote_id = fq.id
  AND fpi.converted_order_id IS NULL
  AND fq.converted_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_field_payment_intent_converted_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.converted_order_id IS NOT NULL AND (OLD.converted_order_id IS DISTINCT FROM NEW.converted_order_id) THEN
    UPDATE public.field_payment_intents
       SET converted_order_id = NEW.converted_order_id,
           updated_at = now()
     WHERE quote_id = NEW.id
       AND converted_order_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_field_payment_intent_converted_order ON public.field_quotes;
CREATE TRIGGER trg_sync_field_payment_intent_converted_order
AFTER UPDATE OF converted_order_id ON public.field_quotes
FOR EACH ROW
EXECUTE FUNCTION public.sync_field_payment_intent_converted_order();