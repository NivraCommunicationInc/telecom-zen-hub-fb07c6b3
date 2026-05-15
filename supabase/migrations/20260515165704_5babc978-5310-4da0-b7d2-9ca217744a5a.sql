CREATE OR REPLACE FUNCTION public.backfill_field_sales_sync()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  sale RECORD;
BEGIN
  FOR sale IN
    SELECT id FROM public.field_sales_orders
    WHERE sync_status IN ('pending','failed')
    OR (sync_status = 'synced' AND converted_order_id IS NULL)
    ORDER BY created_at ASC
  LOOP
    UPDATE public.field_sales_orders
    SET sync_status = 'pending',
        sync_error = NULL
    WHERE id = sale.id;
  END LOOP;
END;
$$;