CREATE OR REPLACE FUNCTION public.backfill_field_sales_sync()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  sale RECORD;
BEGIN
  FOR sale IN
    SELECT f.id
    FROM public.field_sales_orders f
    LEFT JOIN public.orders o ON o.id = f.converted_order_id
    WHERE f.sync_status IN ('pending','failed')
       OR (f.sync_status = 'synced' AND f.converted_order_id IS NULL)
       OR (f.sync_status = 'synced' AND f.converted_order_id IS NOT NULL AND o.id IS NULL)
    ORDER BY f.created_at ASC
  LOOP
    UPDATE public.field_sales_orders
    SET sync_status = 'pending',
        sync_error = NULL
    WHERE id = sale.id;
  END LOOP;
END;
$$;