ALTER TABLE public.field_sales_orders
  ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES public.field_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_field_payment_intent_id uuid REFERENCES public.field_payment_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_sales_orders_source_quote_id
  ON public.field_sales_orders(source_quote_id);

CREATE INDEX IF NOT EXISTS idx_field_sales_orders_source_field_payment_intent_id
  ON public.field_sales_orders(source_field_payment_intent_id);

CREATE OR REPLACE FUNCTION public.sync_field_payment_links_from_field_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.converted_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_quote_id IS NOT NULL THEN
    UPDATE public.field_quotes
       SET converted_order_id = NEW.converted_order_id,
           status = CASE
             WHEN status IN ('converted', 'cancelled', 'expired') THEN status
             ELSE 'converted'
           END,
           updated_at = now()
     WHERE id = NEW.source_quote_id
       AND converted_order_id IS DISTINCT FROM NEW.converted_order_id;
  END IF;

  UPDATE public.field_payment_intents
     SET converted_field_order_id = NEW.id,
         converted_order_id = NEW.converted_order_id,
         updated_at = now()
   WHERE (
       (NEW.source_field_payment_intent_id IS NOT NULL AND id = NEW.source_field_payment_intent_id)
       OR (NEW.source_quote_id IS NOT NULL AND quote_id = NEW.source_quote_id)
     )
     AND (
       converted_field_order_id IS DISTINCT FROM NEW.id
       OR converted_order_id IS DISTINCT FROM NEW.converted_order_id
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_field_payment_links_from_field_order ON public.field_sales_orders;
CREATE TRIGGER trg_sync_field_payment_links_from_field_order
AFTER INSERT OR UPDATE OF converted_order_id, source_quote_id, source_field_payment_intent_id
ON public.field_sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_field_payment_links_from_field_order();